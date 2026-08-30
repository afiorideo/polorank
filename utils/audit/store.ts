/**
 * PoloRank — persisting an audit run and reading it back.
 *
 * Two rules shape this file:
 * - `weight` is written onto every result row as a SNAPSHOT. Redefining a check tomorrow must not rewrite what
 *   yesterday's run concluded — the historical series has to stay trustworthy, which is the whole point of
 *   storing it. Same reason the past is never recalculated and never back-filled.
 * - A run is claimed with `status = 'running'`, which doubles as the lock: a second audit of the same domain
 *   cannot start while one is in flight, so two crawls can never hammer a client's site at once.
 */
import { Op } from 'sequelize';
import AuditRun from '../../database/models/auditRun';
import AuditCheckResult from '../../database/models/auditCheckResult';
import AuditBlockScore from '../../database/models/auditBlockScore';
import AuditPage from '../../database/models/auditPage';
import type { AuditReport } from './engine';
import type { BusinessProfile, CrawledPage } from './types';

/** How long a 'running' row is trusted before it is treated as an abandoned run (a crash, a restart). */
export const STALE_RUN_MS = 30 * 60 * 1000;

export type RunHandle = { id: number, startedAt: number };

/** Claim the lock and open a run. Returns null when another audit of this domain is already in flight. */
export const startRun = async (domain: string, profile: BusinessProfile, triggeredBy: string): Promise<RunHandle | null> => {
   const inFlight = await AuditRun.findOne({ where: { domain, status: 'running' } });
   if (inFlight) {
      const age = Date.now() - new Date(inFlight.get('started_at') as string).getTime();
      if (age < STALE_RUN_MS) { return null; }
      // an abandoned run (crash or restart) must not block the domain forever
      await inFlight.update({ status: 'error', error: 'Corrida abandonada: el proceso terminó sin cerrarla' });
   }
   const row = await AuditRun.create({ domain, started_at: new Date().toJSON(), status: 'running', triggered_by: triggeredBy, profile });
   return { id: row.get('ID') as number, startedAt: Date.now() };
};

/** Store everything a finished run produced, then close it. */
export const saveReport = async (handle: RunHandle, report: AuditReport, pages: CrawledPage[], stoppedBy: string): Promise<void> => {
   const runId = handle.id;
   const { domain } = report;

   await AuditPage.bulkCreate(pages.map((p) => ({
      run_id: runId,
      domain,
      url: p.url,
      status_code: p.statusCode,
      fetched_ok: p.fetchedOk,
      title: p.title,
      h1: p.h1.join(' | '),
      word_count: p.wordCount,
      click_depth: p.clickDepth,
      indexable: p.indexable,
      size_bytes: p.sizeBytes,
   })));

   await AuditCheckResult.bulkCreate(report.outcomes.map((o) => ({
      run_id: runId,
      domain,
      check_id: o.checkId,
      block: o.block,
      url: o.url || '',
      status: o.status,
      score: o.score,
      weight: o.weight, // snapshot: see the note at the top of this file
      evidence: JSON.stringify(o.evidence || {}),
   })));

   await AuditBlockScore.bulkCreate(report.blocks.map((b) => ({
      run_id: runId,
      domain,
      block: b.block,
      compliance: b.compliance,
      coverage: b.coverage,
      weight: report.weights[b.block] || 0,
      capped_by: b.cappedBy,
      checks_total: b.checksTotal,
      checks_measured: b.checksMeasured,
   })));

   await AuditRun.update(
      {
         status: stoppedBy ? 'partial' : 'ok',
         finished_at: new Date().toJSON(),
         duration_ms: Date.now() - handle.startedAt,
         pages_crawled: pages.length,
         error: stoppedBy ? `Corrida acortada por el límite: ${stoppedBy}` : '',
      },
      { where: { ID: runId } },
   );
};

/** Close a run that failed, so the domain is not left locked. */
export const failRun = async (handle: RunHandle, error: string): Promise<void> => {
   await AuditRun.update(
      { status: 'error', finished_at: new Date().toJSON(), duration_ms: Date.now() - handle.startedAt, error },
      { where: { ID: handle.id } },
   );
};

export type RunSummary = {
   runId: number,
   domain: string,
   startedAt: string,
   finishedAt: string | null,
   status: string,
   pagesCrawled: number,
   durationMs: number,
   blocks: { block: string, compliance: number, coverage: number, weight: number, cappedBy: string, checksTotal: number, checksMeasured: number }[],
};

const summaryOf = (run: AuditRun, blocks: AuditBlockScore[]): RunSummary => ({
   runId: run.get('ID') as number,
   domain: run.get('domain') as string,
   startedAt: run.get('started_at') as string,
   finishedAt: run.get('finished_at') as string | null,
   status: run.get('status') as string,
   pagesCrawled: run.get('pages_crawled') as number,
   durationMs: run.get('duration_ms') as number,
   blocks: blocks.map((b) => ({
      block: b.get('block') as string,
      compliance: b.get('compliance') as number,
      coverage: b.get('coverage') as number,
      weight: b.get('weight') as number,
      cappedBy: b.get('capped_by') as string,
      checksTotal: b.get('checks_total') as number,
      checksMeasured: b.get('checks_measured') as number,
   })),
});

/** Latest finished run of a domain, with its block scores. null when the domain was never audited. */
export const latestRun = async (domain: string): Promise<RunSummary | null> => {
   const run = await AuditRun.findOne({
      where: { domain, status: { [Op.in]: ['ok', 'partial'] } },
      order: [['ID', 'DESC']],
   });
   if (!run) { return null; }
   const blocks = await AuditBlockScore.findAll({ where: { run_id: run.get('ID') as number } });
   return summaryOf(run, blocks);
};

/** Latest run of every domain, for the portfolio screen. */
export const latestRunPerDomain = async (domains: string[]): Promise<Record<string, RunSummary>> => {
   const out: Record<string, RunSummary> = {};
   for (const domain of domains) {
      // eslint-disable-next-line no-await-in-loop
      const summary = await latestRun(domain);
      if (summary) { out[domain] = summary; }
   }
   return out;
};

export type CheckRow = {
   checkId: string,
   block: string,
   url: string,
   status: string,
   score: number,
   weight: number,
   evidence: Record<string, unknown>,
   reviewedAt: string | null,
   reviewNote: string,
};

/**
 * Every verdict of a run, worst first: what failed, heaviest first, then everything else.
 * The evidence travels with each row — a verdict you cannot argue with is a verdict you cannot trust.
 */
export const runChecks = async (runId: number): Promise<CheckRow[]> => {
   const rows = await AuditCheckResult.findAll({ where: { run_id: runId } });
   const orden: Record<string, number> = { fail: 0, partial: 1, pending_review: 2, pass: 3, na: 4 };
   return rows
      .map((r) => {
         let evidence: Record<string, unknown> = {};
         try { evidence = JSON.parse((r.get('evidence') as string) || '{}'); } catch { evidence = {}; }
         return {
            checkId: r.get('check_id') as string,
            block: r.get('block') as string,
            url: r.get('url') as string,
            status: r.get('status') as string,
            score: r.get('score') as number,
            weight: r.get('weight') as number,
            evidence,
            reviewedAt: r.get('reviewed_at') as string | null,
            reviewNote: r.get('review_note') as string,
         };
      })
      .sort((a, b) => (orden[a.status] - orden[b.status]) || (b.weight - a.weight) || a.checkId.localeCompare(b.checkId));
};
