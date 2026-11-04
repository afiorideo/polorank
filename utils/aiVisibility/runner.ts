import zlib from 'zlib';
import { Op } from 'sequelize';
import AiPrompt from '../../database/models/aiPrompt';
import AiRun from '../../database/models/aiRun';
import AiAnswer from '../../database/models/aiAnswer';
import Domain from '../../database/models/domain';
import Keyword from '../../database/models/keyword';
import { logUsage } from '../usage';
import { dfsCall } from './dfs';
import { ENGINE_DEF } from './engines';
import { analyzeAnswer } from './analyze';
import { parseAiSettings, targetFor, AiDomainSettings } from './config';
import { ENGINES, REPS, Engine, estimateCost, monthSpend } from './budget';
import { weekOf } from './week';
import { runGoogleIa } from './googleIa';

export type RunScope = { kind: 'all' } | { kind: 'domain', domain: string } | { kind: 'prompt', promptId: number } | { kind: 'google', domain: string };

export const packRaw = (o: unknown): string => zlib.deflateSync(Buffer.from(JSON.stringify(o))).toString('base64');
export const unpackRaw = (s: string): unknown => JSON.parse(zlib.inflateSync(Buffer.from(s, 'base64')).toString());
export const budgetAllows = (spent: number, estimate: number, budget: number): boolean => spent + estimate <= budget;
/** 40601 "Task Handed" / 40602 "Task In Queue": la tarea sigue en proceso, no es un error. */
export const isQueuedStatus = (code: number | undefined | null): boolean => code === 40601 || code === 40602;

const POOL = 5;
const pool = async <T>(jobs: (() => Promise<T>)[]): Promise<T[]> => {
   const out: T[] = []; let i = 0;
   const worker = async () => { while (i < jobs.length) { const j = i; i += 1; out[j] = await jobs[j](); } };
   await Promise.all(Array.from({ length: Math.min(POOL, jobs.length) }, worker));
   return out;
};

/** Configuración IA de todos los dominios (habilitados o no). */
const domainSettings = async (): Promise<Map<string, AiDomainSettings>> => {
   const all = await Domain.findAll();
   const m = new Map<string, AiDomainSettings>();
   all.forEach((d) => { m.set(d.get('domain') as string, parseAiSettings(d.get('ai_settings') as string, d.get('domain') as string)); });
   return m;
};

const enabledDomains = async (): Promise<Map<string, AiDomainSettings>> => {
   const m = await domainSettings();
   [...m.keys()].forEach((k) => { if (!(m.get(k) as AiDomainSettings).enabled) { m.delete(k); } });
   return m;
};

/** Estado de cierre de una corrida según sus respuestas. */
export const runStatus = (pending: number, errors: number): 'pending' | 'partial' | 'done' => {
   if (pending > 0) { return 'pending'; }
   return errors > 0 ? 'partial' : 'done';
};

/** Cierra la corrida si ya no quedan respuestas pendientes. Devuelve su estado. */
const closeRunIfDone = async (run: AiRun, cost?: number): Promise<string> => {
   const runId = run.get('ID') as number;
   const pending = await AiAnswer.count({ where: { run_id: runId, status: 'pending' } });
   const errors = await AiAnswer.count({ where: { run_id: runId, status: 'error' } });
   const status = runStatus(pending, errors);
   const values: Record<string, unknown> = { status, finished_at: status === 'pending' ? null : new Date().toJSON() };
   if (cost !== undefined) { values.cost_usd = cost; }
   if (cost !== undefined || status !== 'pending') { await run.update(values); }
   return status;
};

export const planRun = async (scope: RunScope, mode: 'queue' | 'live') => {
   const doms = await enabledDomains();
   let domains: string[] = [];
   if (scope.kind === 'all') { domains = [...doms.keys()]; }
   if (scope.kind === 'domain' || scope.kind === 'google') { domains = doms.has(scope.domain) ? [scope.domain] : []; }
   let prompts: AiPrompt[] = [];
   if (scope.kind === 'prompt') {
      const p = await AiPrompt.findByPk(scope.promptId);
      if (p && doms.has(p.get('domain') as string)) { prompts = [p]; domains = [p.get('domain') as string]; }
   } else if (scope.kind !== 'google' && domains.length) {
      prompts = await AiPrompt.findAll({ where: { domain: { [Op.in]: domains }, active: true } });
   }
   const keywords = (scope.kind === 'all' || scope.kind === 'google') && domains.length
      ? await Keyword.count({ where: { domain: { [Op.in]: domains } } }) : 0;
   return { prompts, domains, keywords, estimate: estimateCost(prompts.length, keywords, mode), cfgs: doms };
};

/** Guarda una respuesta ya recibida: análisis + raw comprimido. */
const storeResult = async (answer: AiAnswer, engine: Engine, result: any, cost: number, cfg: AiDomainSettings) => {
   const parsed = ENGINE_DEF[engine].parse(result);
   const a = analyzeAnswer(parsed, cfg);
   await answer.update({
      status: 'ok', mentioned: a.mentioned, cited: a.cited, position: a.position,
      brands: JSON.stringify(a.brands), sources: JSON.stringify(parsed.sources), fan_out: JSON.stringify(parsed.fanOut),
      text: parsed.text, raw: packRaw(result), cost_usd: Number(answer.get('cost_usd') || 0) + cost,
   });
};

export const startRun = async (scope: RunScope, mode: 'queue' | 'live', triggeredBy: string, settings: SettingsType) => {
   const creds = settings.ai_dataforseo_credentials || '';
   const plan = await planRun(scope, mode);
   const scopeLabel = scope.kind === 'all' ? 'all' : `${scope.kind}:${scope.kind === 'prompt' ? scope.promptId : scope.domain}`;
   const run = await AiRun.create({ started_at: new Date().toJSON(), triggered_by: triggeredBy, scope: scopeLabel, est_cost_usd: plan.estimate });
   const runId = run.get('ID') as number;
   if (!creds) {
      await run.update({ status: 'skipped_no_credentials', finished_at: new Date().toJSON() });
      return { runId, status: 'skipped_no_credentials', estimate: plan.estimate };
   }
   const budget = settings.ai_monthly_budget_usd ?? 2;
   if (!budgetAllows(await monthSpend(), plan.estimate, budget)) {
      await run.update({ status: 'skipped_budget', finished_at: new Date().toJSON() });
      return { runId, status: 'skipped_budget', estimate: plan.estimate };
   }
   const week = weekOf(new Date());
   let cost = 0;

   // una semana = un dato: lo nuevo reemplaza lo de esta semana, solo para los prompts de esta corrida
   if (plan.prompts.length) {
      await AiAnswer.destroy({ where: { week, prompt_id: { [Op.in]: plan.prompts.map((p) => p.get('ID') as number) } } });
   }
   const jobs: (() => Promise<void>)[] = [];
   plan.prompts.forEach((p) => {
      const domain = p.get('domain') as string;
      const cfg = plan.cfgs.get(domain) as AiDomainSettings;
      const target = targetFor(cfg, p.get({ plain: true }));
      ENGINES.forEach((engine) => {
         for (let rep = 1; rep <= REPS; rep += 1) {
            jobs.push(async () => {
               let answer: AiAnswer | null = null;
               try {
                  const def = ENGINE_DEF[engine];
                  answer = await AiAnswer.create({ run_id: runId, prompt_id: p.get('ID'), domain, engine, rep, week, created_at: new Date().toJSON() });
                  const useQueue = mode === 'queue' && !!def.post;
                  const r = await dfsCall('POST', useQueue ? (def.post as string) : def.live, creds, [def.task(p.get('prompt') as string, target)]);
                  cost += r.cost;
                  await logUsage({ scraper: `ai:${engine}`, domain, keywordID: p.get('ID') as number, keyword: p.get('prompt') as string, depth: 0, costUSD: r.cost, triggeredBy, status: r.ok ? 'ok' : 'error' });
                  if (!r.ok || !r.task) { await answer.update({ status: 'error', error: r.error || 'sin respuesta', cost_usd: r.cost }); return; }
                  if (useQueue) { await answer.update({ task_id: r.task.id, cost_usd: r.cost }); return; }
                  const result = r.task.result?.[0];
                  if (!result) { await answer.update({ status: 'error', error: `${r.task.status_code} ${r.task.status_message}`, cost_usd: r.cost }); return; }
                  await storeResult(answer, engine, result, r.cost, cfg);
               } catch (e: any) {
                  try { await answer?.update({ status: 'error', error: String(e?.message || e) }); } catch { /* sin más recurso */ }
               }
            });
         }
      });
   });
   await pool(jobs);
   if (scope.kind === 'all' || scope.kind === 'google') {
      for (const d of plan.domains) {
         try {
            // eslint-disable-next-line no-await-in-loop
            const g = await runGoogleIa(d, creds, triggeredBy);
            cost += g.cost;
         } catch (e) { console.log('[ERROR] Google IA falló para', d, e); }
      }
   }
   const status = await closeRunIfDone(run, cost);
   return { runId, status, estimate: plan.estimate };
};

/** Recoge las tareas en cola que ya terminaron. Lo pendiente por más de 24 h pasa a error. */
export const collectPending = async (settings: SettingsType) => {
   const creds = settings.ai_dataforseo_credentials || '';
   const pending = await AiAnswer.findAll({ where: { status: 'pending', task_id: { [Op.ne]: '' } }, limit: 400 });
   const cfgs = await domainSettings();
   let collected = 0; let errors = 0;
   await pool(pending.map((a) => async () => {
      try {
         const engine = a.get('engine') as Engine;
         const def = ENGINE_DEF[engine];
         const r = await dfsCall('GET', (def.get as (id: string) => string)(a.get('task_id') as string), creds);
         const code = r.task?.status_code;
         if (r.ok && code === 20000 && r.task.result?.[0]) {
            const cfg = cfgs.get(a.get('domain') as string) || parseAiSettings('', a.get('domain') as string);
            await storeResult(a, engine, r.task.result[0], 0, cfg); collected += 1; return;
         }
         const age = Date.now() - new Date(a.get('created_at') as string).getTime();
         if (age > 24 * 3600 * 1000 || (code && code >= 40000 && !isQueuedStatus(code))) {
            await a.update({ status: 'error', error: r.error || `${code} ${r.task?.status_message}` }); errors += 1;
         }
      } catch (e: any) {
         try { await a.update({ status: 'error', error: String(e?.message || e) }); errors += 1; } catch { /* sin más recurso */ }
      }
   }));
   // cerrar corridas sin pendientes
   const runs = await AiRun.findAll({ where: { status: 'pending' } });
   for (const run of runs) {
      // eslint-disable-next-line no-await-in-loop
      await closeRunIfDone(run);
   }
   // purga de raw con más de 26 semanas
   const limit = new Date(Date.now() - 26 * 7 * 24 * 3600 * 1000).toJSON();
   await AiAnswer.update({ raw: '' }, { where: { created_at: { [Op.lt]: limit }, raw: { [Op.ne]: '' } } });
   return { collected, errors };
};
