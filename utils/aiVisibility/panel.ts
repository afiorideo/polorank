import { ENGINES, Engine } from './budget';
import { newCompetitors } from './analyze';
import type { AiDomainSettings } from './config';

export type EngineCell = { mentioned: number, total: number, bestPosition: number, cited: number };
export type AiVisibilityData = {
   lastRun: { started_at: string, status: string } | null,
   nextRun: string,
   monthSpend: number, budget: number,
   totals: { answers: number, mentioned: number, cited: number, avgPosition: number },
   byEngine: Record<Engine, { prompts: number, promptsWithMention: number, answers: number, mentioned: number }>,
   prompts: {
      id: number, prompt: string, tags: string[], cells: Record<Engine, EngineCell>,
      topBrands: { name: string, count: number }[], deltaVsPrev: number | null,
   }[],
   competitors: { name: string, total: number, byEngine: Record<Engine, number> }[],
   sources: Record<Engine, { domain: string, count: number }[]>,
   evolution: { week: string, ownRate: number, topCompetitor: string, competitorRate: number }[],
   detectedCompetitors: string[],
};

type PromptRow = { ID: number, prompt: string, tags: string };
type AnswerRow = {
   prompt_id: number, engine: string, week: string, status: string,
   mentioned: number, cited: number, position: number, brands: string, sources: string,
};

const parse = <T, >(raw: unknown, fallback: T): T => {
   try { const v = JSON.parse((raw as string) || ''); return (v ?? fallback) as T; } catch { return fallback; }
};
const perEngine = <T, >(make: () => T): Record<Engine, T> => Object.fromEntries(ENGINES.map((e) => [e, make()])) as Record<Engine, T>;
const sortDesc = <T extends { count: number }>(a: T, b: T): number => b.count - a.count;

/** Cuenta marcas (sin la propia) de un conjunto de respuestas. */
const brandCounts = (answers: AnswerRow[], ownName: string): Map<string, number> => {
   const own = ownName.toLowerCase();
   const m = new Map<string, number>();
   answers.forEach((a) => parse<string[]>(a.brands, []).forEach((b) => {
      if (b.toLowerCase() !== own) { m.set(b, (m.get(b) || 0) + 1); }
   }));
   return m;
};

/** Función pura: arma los datos del panel. `weeks` viene con la semana más reciente primero. */
export const buildPanel = (
   prompts: PromptRow[], answers: AnswerRow[], weeks: string[], ownName: string, cfg?: AiDomainSettings,
): Omit<AiVisibilityData, 'lastRun' | 'nextRun' | 'monthSpend' | 'budget'> => {
   const ok = answers.filter((a) => a.status === 'ok');
   const latestWeek = weeks[0];
   const latest = ok.filter((a) => a.week === latestWeek);

   const cellOf = (rows: AnswerRow[]): EngineCell => {
      const pos = rows.map((r) => r.position).filter((p) => p > 0);
      return {
         mentioned: rows.reduce((s, r) => s + (r.mentioned ? 1 : 0), 0),
         total: rows.length,
         bestPosition: pos.length ? Math.min(...pos) : 0,
         cited: rows.reduce((s, r) => s + (r.cited ? 1 : 0), 0),
      };
   };

   const byEngine = perEngine(() => ({ prompts: 0, promptsWithMention: 0, answers: 0, mentioned: 0 }));
   const promptRows = prompts.map((p) => {
      const mine = latest.filter((a) => a.prompt_id === p.ID);
      const cells = perEngine<EngineCell>(() => ({ mentioned: 0, total: 0, bestPosition: 0, cited: 0 }));
      ENGINES.forEach((e) => {
         const rows = mine.filter((a) => a.engine === e);
         cells[e] = cellOf(rows);
         if (rows.length) {
            byEngine[e].prompts += 1;
            byEngine[e].answers += rows.length;
            byEngine[e].mentioned += cells[e].mentioned;
            if (cells[e].mentioned > 0) { byEngine[e].promptsWithMention += 1; }
         }
      });
      const topBrands = Array.from(brandCounts(mine, ownName)).map(([name, count]) => ({ name, count })).sort(sortDesc).slice(0, 4);
      let deltaVsPrev: number | null = null;
      if (weeks.length > 1) {
         const m = (w: string) => ok.filter((a) => a.week === w && a.prompt_id === p.ID && a.mentioned).length;
         deltaVsPrev = m(weeks[0]) - m(weeks[1]);
      }
      return { id: p.ID, prompt: p.prompt, tags: parse<string[]>(p.tags, []), cells, topBrands, deltaVsPrev };
   });

   const positions = latest.map((a) => a.position).filter((p) => p > 0);
   const totals = {
      answers: latest.length,
      mentioned: latest.filter((a) => a.mentioned).length,
      cited: latest.filter((a) => a.cited).length,
      avgPosition: positions.length ? Math.round((positions.reduce((s, p) => s + p, 0) / positions.length) * 10) / 10 : 0,
   };

   const compMap = new Map<string, { name: string, total: number, byEngine: Record<Engine, number> }>();
   const own = ownName.toLowerCase();
   latest.forEach((a) => parse<string[]>(a.brands, []).forEach((b) => {
      if (b.toLowerCase() === own) { return; }
      const c = compMap.get(b) || { name: b, total: 0, byEngine: perEngine(() => 0) };
      c.total += 1;
      if (ENGINES.includes(a.engine as Engine)) { c.byEngine[a.engine as Engine] += 1; }
      compMap.set(b, c);
   }));
   const competitors = Array.from(compMap.values()).sort((a, b) => b.total - a.total);

   const sources = perEngine<{ domain: string, count: number }[]>(() => []);
   ENGINES.forEach((e) => {
      const m = new Map<string, number>();
      latest.filter((a) => a.engine === e).forEach((a) => parse<{ domain: string }[]>(a.sources, []).forEach((s) => {
         if (s.domain) { m.set(s.domain, (m.get(s.domain) || 0) + 1); }
      }));
      sources[e] = Array.from(m).map(([domain, count]) => ({ domain, count })).sort(sortDesc).slice(0, 10);
   });

   const evolution = weeks.slice(0, 12).map((week) => {
      const rows = ok.filter((a) => a.week === week);
      const top = Array.from(brandCounts(rows, ownName)).sort((a, b) => b[1] - a[1])[0];
      return {
         week,
         ownRate: rows.length ? rows.filter((a) => a.mentioned).length / rows.length : 0,
         topCompetitor: top ? top[0] : '',
         competitorRate: rows.length && top ? top[1] / rows.length : 0,
      };
   }).reverse();

   const detected = cfg
      ? newCompetitors(latest.filter((a) => a.engine === 'chatgpt').flatMap((a) => parse<string[]>(a.brands, [])), cfg)
      : [];

   return { totals, byEngine, prompts: promptRows, competitors, sources, evolution, detectedCompetitors: Array.from(new Set(detected)) };
};
