/**
 * PoloRank — what changed between two audits, and what the positions did afterwards.
 *
 * This is the reason the module exists. A bought SEO auditor shows you a photograph; this one can show the
 * film, because the same database holds the daily position history and the dated audit results. Nobody else
 * has both series for the same site, so nobody else can answer "you changed the title on the 12th — did it
 * work?".
 *
 * Two honesty rules:
 * - A check that did not exist in the older run is reported as NEW, never as "it used to fail". A catalogue
 *   that grows must not rewrite the past.
 * - The correlation is stated as coincidence in time, never as cause. SEO moves for many reasons at once;
 *   the screen shows what changed and what happened next, and lets the person decide.
 */
import { historyPoints } from '../history';

export type CheckChange = {
   checkId: string,
   block: string,
   url: string,
   before: string | null,
   after: string,
   /** 'fixed' | 'broke' | 'new' | 'gone' */
   kind: 'fixed' | 'broke' | 'new' | 'gone',
};

export type PositionMove = {
   keyword: string,
   /** Position on the day of the older audit (or the closest measured day). */
   before: number,
   after: number,
   /** before − after: positive means it improved. null when either end was not measured. */
   change: number | null,
};

const key = (checkId: string, url: string): string => `${checkId}|${url}`;

/**
 * Compare two sets of verdicts. `before` is the older run.
 * A check present only in the new run is 'new'; only in the old one is 'gone' (it was removed from the catalogue).
 */
export const diffChecks = (
   before: { checkId: string, block: string, url: string, status: string }[],
   after: { checkId: string, block: string, url: string, status: string }[],
): CheckChange[] => {
   const beforeMap = new Map(before.map((c) => [key(c.checkId, c.url), c]));
   const afterMap = new Map(after.map((c) => [key(c.checkId, c.url), c]));
   const out: CheckChange[] = [];

   afterMap.forEach((now, k) => {
      const then = beforeMap.get(k);
      if (!then) {
         out.push({ checkId: now.checkId, block: now.block, url: now.url, before: null, after: now.status, kind: 'new' });
         return;
      }
      if (then.status === now.status) { return; }
      const mejoro = then.status !== 'pass' && now.status === 'pass';
      const empeoro = then.status === 'pass' && now.status !== 'pass';
      if (mejoro || empeoro) {
         out.push({ checkId: now.checkId, block: now.block, url: now.url, before: then.status, after: now.status, kind: mejoro ? 'fixed' : 'broke' });
      }
   });

   beforeMap.forEach((then, k) => {
      if (!afterMap.has(k)) {
         out.push({ checkId: then.checkId, block: then.block, url: then.url, before: then.status, after: 'gone', kind: 'gone' });
      }
   });

   return out;
};

/** Position on a given day, or the closest measured day within a tolerance. null when nothing is close enough. */
export const positionOn = (history: KeywordHistory, isoDate: string, toleranceDays = 3): number | null => {
   const target = new Date(isoDate).getTime();
   if (!Number.isFinite(target)) { return null; }
   let best: { diff: number, position: number } | null = null;
   historyPoints(history).forEach((p) => {
      const diff = Math.abs(p.time - target);
      if (diff <= toleranceDays * 24 * 60 * 60 * 1000 && (!best || diff < best.diff)) {
         best = { diff, position: p.position };
      }
   });
   return best ? (best as { position: number }).position : null;
};

/**
 * How the tracked keywords moved between the two audit dates.
 * A position of 0 means "not found", which is not a number: those comparisons return null instead of a made-up
 * magnitude — the same rule the tracking columns follow.
 */
export const positionMoves = (
   keywords: { keyword: string, history: KeywordHistory }[],
   fromIso: string,
   toIso: string,
): PositionMove[] => keywords.map((k) => {
   const before = positionOn(k.history, fromIso);
   const after = positionOn(k.history, toIso);
   const comparable = before !== null && after !== null && before > 0 && after > 0;
   return {
      keyword: k.keyword,
      before: before ?? 0,
      after: after ?? 0,
      change: comparable ? (before as number) - (after as number) : null,
   };
});

export default diffChecks;
