/**
 * PoloRank — orchestrating one audit: gather, decide, store.
 *
 * The isolation rule of this module lives here: NOTHING in `utils/audit/` is ever imported by `utils/refresh.ts`,
 * `utils/scraper.ts` or `cron.js`. The audit depends on the tracker's data, never the other way round, so a bug
 * in the crawler cannot reach the position scraping — which is the job this server cannot afford to lose.
 */
import Keyword from '../../database/models/keyword';
import Domain from '../../database/models/domain';
import KeywordDaily from '../../database/models/keywordDaily';
import parseKeywords from '../parseKeywords';
import { crawlSite } from './crawler';
import { runAudit } from './engine';
import { startRun, saveReport, failRun } from './store';
import type { AuditInput, AuditKeyword, BusinessProfile } from './types';

export type AuditSettings = { profile: BusinessProfile, maxPages: number, cities: string[] };

export const DEFAULT_AUDIT_SETTINGS: AuditSettings = { profile: 'local_national', maxPages: 60, cities: [] };

export const settingsOf = (domain: Domain): AuditSettings => {
   try {
      const raw = JSON.parse((domain.get('audit_settings') as string) || '{}');
      return { ...DEFAULT_AUDIT_SETTINGS, ...raw };
   } catch {
      return DEFAULT_AUDIT_SETTINGS;
   }
};

/**
 * What the tracker already knows about this domain's keywords: the page we chose, the page Google shows,
 * the volume and the SERP of the last measured day. This is the part no bought tool can reproduce.
 */
export const keywordsFor = async (domain: string): Promise<AuditKeyword[]> => {
   const rows = await Keyword.findAll({ where: { domain } });
   const parsed = parseKeywords(rows.map((r) => r.get({ plain: true })));
   const out: AuditKeyword[] = [];
   for (const kw of parsed) {
      // eslint-disable-next-line no-await-in-loop
      const day = await KeywordDaily.findOne({ where: { keyword_id: kw.ID }, order: [['date', 'DESC']] });
      let serpTop: AuditKeyword['serpTop'] = [];
      let serpFeatures: string[] = kw.serpFeatures || [];
      if (day) {
         try { serpTop = JSON.parse((day.get('serp_top') as string) || '[]'); } catch { serpTop = []; }
         try { serpFeatures = JSON.parse((day.get('serp_features') as string) || '[]'); } catch { /* keep the keyword's own */ }
      }
      out.push({
         keyword: kw.keyword,
         targetUrl: kw.targetUrl || '',
         rankingUrl: kw.url || '',
         position: kw.position,
         targetPosition: kw.targetPosition || 0,
         volume: kw.volume || 0,
         serpFeatures,
         serpTop,
      });
   }
   return out;
};

export type AuditOutcome = { ok: boolean, runId?: number, error?: string };

/** Run a full audit of one domain. Never throws: a failure closes the run and is reported. */
export const auditDomain = async (domainRow: Domain, triggeredBy: string): Promise<AuditOutcome> => {
   const domain = domainRow.get('domain') as string;
   const settings = settingsOf(domainRow);
   const handle = await startRun(domain, settings.profile, triggeredBy);
   if (!handle) { return { ok: false, error: 'Ya hay una auditoría en curso para este dominio.' }; }

   try {
      const keywords = await keywordsFor(domain);
      // the home and every page we chose to rank are visited first, so the cap can never cut them out
      const seeds = [`https://${domain}/`, ...keywords.map((k) => k.targetUrl).filter(Boolean)];
      const crawl = await crawlSite({ seeds: [...new Set(seeds)], limits: { maxPages: settings.maxPages } });

      const input: AuditInput = {
         domain,
         profile: settings.profile,
         pages: crawl.pages,
         home: crawl.pages[0],
         keywords,
         cities: settings.cities,
      };
      const report = runAudit(input);
      await saveReport(handle, report, crawl.pages, crawl.stoppedBy);
      return { ok: true, runId: handle.id };
   } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await failRun(handle, msg);
      console.log('[ERROR] La auditoría falló para', domain, msg);
      return { ok: false, error: msg };
   }
};

export default auditDomain;
