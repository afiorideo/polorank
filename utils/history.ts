/**
 * PoloRank — pure helpers over a keyword's position history (`{ 'YYYY-M-D': position }`, one point per day).
 * No DB, no React: used by the API (stats per keyword) and by the UI (panel, monthly table). Fully unit-tested.
 *
 * Conventions:
 * - position 0 = not found in the scraped results. For change math it counts as OUT (worse than any real position).
 * - change = pastPosition − currentPosition → positive = improved (moved up), negative = dropped.
 */

export type HistoryPoint = { date: string, time: number, position: number };

export type KeywordChange = {
   /** pastPosition − currentPosition (positive = improved). null when there is no data point around that day. */
   change: number | null,
   /** Position on that past day (0 = not found). null when no data. */
   position: number | null,
};

export type KeywordStats = {
   best: { position: number, date: string } | null,
   changes: { d7: KeywordChange, d30: KeywordChange, d60: KeywordChange, d90: KeywordChange },
   /** Organic results actually received in the last scrape (for the "+N" label). */
   resultsReceived: number,
   /** Number of days with data. */
   historyDays: number,
};

export type MonthSummary = {
   /** 'YYYY-MM' */
   month: string,
   /** Human label, e.g. 'Ago 2026' */
   label: string,
   best: number | null,
   avg: number | null,
   worst: number | null,
   /** vs. previous month's average (positive = improved). null when either month lacks data. */
   change: number | null,
   /** Days with data in the month */
   days: number,
   /** Days the keyword was not found */
   notFoundDays: number,
};

const OUT_OF_RANGE = 101;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Parse a SerpBear history key ('YYYY-M-D') into a local-midnight timestamp. Invalid keys → NaN. */
export const parseHistoryKey = (key: string): number => {
   const parts = key.split('-').map((p) => parseInt(p, 10));
   if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) { return NaN; }
   return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
};

/** Build a SerpBear-style key for a date (no zero padding, local time). */
export const historyKey = (date: Date): string => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

/** Sorted (oldest → newest) list of valid points. */
export const historyPoints = (history: KeywordHistory | undefined | null): HistoryPoint[] => {
   if (!history) { return []; }
   return Object.keys(history)
      .map((date) => ({ date, time: parseHistoryKey(date), position: Number(history[date]) || 0 }))
      .filter((p) => Number.isFinite(p.time))
      .sort((a, b) => a.time - b.time);
};

const normalize = (position: number): number => (position > 0 ? position : OUT_OF_RANGE);

/**
 * Position N days ago: the closest data point within ±tolerance days of the target day.
 * Returns null when there is no point in that window.
 */
export const positionAt = (
   history: KeywordHistory | undefined | null,
   daysAgo: number,
   now: Date = new Date(),
   tolerance: number = 3,
): { position: number, date: string } | null => {
   const points = historyPoints(history);
   if (points.length === 0) { return null; }
   const target = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - daysAgo * DAY_MS;
   let bestPoint: HistoryPoint | null = null;
   let bestDiff = Infinity;
   for (const p of points) {
      const diff = Math.abs(p.time - target);
      if (diff <= tolerance * DAY_MS && (diff < bestDiff || (diff === bestDiff && bestPoint && p.time < bestPoint.time))) {
         bestPoint = p;
         bestDiff = diff;
      }
   }
   return bestPoint ? { position: bestPoint.position, date: bestPoint.date } : null;
};

/** Change vs. N days ago. Requires the keyword to have a current position (0 = out) and a past point. */
export const changeSince = (
   history: KeywordHistory | undefined | null,
   currentPosition: number,
   daysAgo: number,
   now: Date = new Date(),
): KeywordChange => {
   const past = positionAt(history, daysAgo, now);
   if (!past) { return { change: null, position: null }; }
   if (past.position === 0 && currentPosition === 0) { return { change: 0, position: 0 }; }
   return { change: normalize(past.position) - normalize(currentPosition), position: past.position };
};

/** Best (lowest, > 0) position ever, with the first date it was reached. */
export const bestPosition = (history: KeywordHistory | undefined | null): { position: number, date: string } | null => {
   const points = historyPoints(history).filter((p) => p.position > 0);
   if (points.length === 0) { return null; }
   let best = points[0];
   for (const p of points) { if (p.position < best.position) { best = p; } }
   return { position: best.position, date: best.date };
};

/** Organic results actually received in the last scrape (entries not marked skipped). */
export const resultsReceived = (lastResult: KeywordLastResult[] | undefined | null): number => {
   if (!Array.isArray(lastResult)) { return 0; }
   return lastResult.filter((r) => r && !r.skipped && r.url).length;
};

/** Label for a keyword that was not found: "+N" where N = results really checked (falls back to the depth requested, then 100). */
export const notFoundLabel = (received: number, lastDepth?: number): string => {
   let n = 100;
   if (received > 0) { n = received; } else if (lastDepth && lastDepth > 0) { n = lastDepth; }
   return `+${n}`;
};

/** Everything the table needs, computed once per keyword. */
export const summarizeHistory = (
   history: KeywordHistory | undefined | null,
   currentPosition: number,
   lastResult?: KeywordLastResult[] | null,
   now: Date = new Date(),
): KeywordStats => ({
   best: bestPosition(history),
   changes: {
      d7: changeSince(history, currentPosition, 7, now),
      d30: changeSince(history, currentPosition, 30, now),
      d60: changeSince(history, currentPosition, 60, now),
      d90: changeSince(history, currentPosition, 90, now),
   },
   resultsReceived: resultsReceived(lastResult),
   historyDays: historyPoints(history).length,
});

/** Keep only the last N days of history (for lighter list responses). */
export const sliceHistory = (history: KeywordHistory | undefined | null, days: number, now: Date = new Date()): KeywordHistory => {
   const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - days * DAY_MS;
   const out: KeywordHistory = {};
   historyPoints(history).filter((p) => p.time >= from).forEach((p) => { out[p.date] = p.position; });
   return out;
};

/** Trend of the keyword vs. N days ago: 'up' | 'down' | 'same' | 'none' (no data). */
export const trendOf = (stats: KeywordStats | undefined | null, compareDays: 7 | 30 | 60 | 90): 'up' | 'down' | 'same' | 'none' => {
   const key = `d${compareDays}` as keyof KeywordStats['changes'];
   const change = stats?.changes?.[key]?.change;
   if (change === null || change === undefined) { return 'none'; }
   if (change > 0) { return 'up'; }
   if (change < 0) { return 'down'; }
   return 'same';
};

export const monthLabel = (month: string): string => {
   const [y, m] = month.split('-').map((p) => parseInt(p, 10));
   return `${MONTHS_ES[(m || 1) - 1]} ${y}`;
};

/** Per-month summary (most recent first). Positions of 0 count as "not found" days and are excluded from best/avg/worst. */
export const monthlySummary = (history: KeywordHistory | undefined | null): MonthSummary[] => {
   const groups: { [month: string]: number[] } = {};
   const notFound: { [month: string]: number } = {};
   historyPoints(history).forEach((p) => {
      const d = new Date(p.time);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[month]) { groups[month] = []; notFound[month] = 0; }
      if (p.position > 0) { groups[month].push(p.position); } else { notFound[month] += 1; }
   });
   const months = Object.keys(groups).sort();
   const summaries: MonthSummary[] = months.map((month) => {
      const found = groups[month];
      const avg = found.length > 0 ? Math.round((found.reduce((a, b) => a + b, 0) / found.length) * 10) / 10 : null;
      return {
         month,
         label: monthLabel(month),
         best: found.length > 0 ? Math.min(...found) : null,
         avg,
         worst: found.length > 0 ? Math.max(...found) : null,
         change: null,
         days: found.length + notFound[month],
         notFoundDays: notFound[month],
      };
   });
   for (let i = 1; i < summaries.length; i += 1) {
      const prev = summaries[i - 1].avg;
      const cur = summaries[i].avg;
      summaries[i].change = prev !== null && cur !== null ? Math.round((prev - cur) * 10) / 10 : null;
   }
   return summaries.reverse();
};

/** Average position over the last N days (found days only). null when nothing found. */
export const averagePosition = (history: KeywordHistory | undefined | null, days: number, now: Date = new Date()): number | null => {
   const points = historyPoints(sliceHistory(history, days, now)).filter((p) => p.position > 0);
   if (points.length === 0) { return null; }
   return Math.round((points.reduce((a, p) => a + p.position, 0) / points.length) * 10) / 10;
};

export type ChartSeries = { labels: string[], series: (number | null)[] };

const SHORT_MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Short label for a chart tick: "24 ago" */
export const shortDateLabel = (time: number): string => {
   const d = new Date(time);
   return `${d.getDate()} ${SHORT_MONTHS_ES[d.getMonth()]}`;
};

/**
 * Daily series for a chart, clipped to the days that actually have data (no fake "out of range" before the keyword existed):
 * - starts at max(range start, first data point), ends today
 * - days without a scrape carry the previous value
 * - "not found" days (0) become null → the chart shows a gap instead of a fake position
 */
export const chartSeries = (history: KeywordHistory | undefined | null, days: number | 'all', now: Date = new Date()): ChartSeries => {
   const points = historyPoints(history);
   const out: ChartSeries = { labels: [], series: [] };
   if (points.length === 0) { return out; }
   const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
   const rangeStart = days === 'all' ? points[0].time : today - days * DAY_MS;
   const start = Math.max(rangeStart, points[0].time);
   const byTime: { [t: number]: number } = {};
   points.forEach((p) => { byTime[p.time] = p.position; });
   let last: number | null = null;
   for (let t = start; t <= today; t += DAY_MS) {
      const key = new Date(t).setHours(0, 0, 0, 0);
      if (byTime[key] !== undefined) { last = byTime[key]; }
      out.labels.push(shortDateLabel(key));
      out.series.push(last === null || last === 0 ? null : last);
   }
   return out;
};

/**
 * Change over a range for the panel: vs. N days ago when there is data, otherwise vs. the first data point
 * (so a keyword tracked for 12 days still shows its change under "6 meses").
 */
export const rangeChange = (
   history: KeywordHistory | undefined | null,
   currentPosition: number,
   days: number | 'all',
   now: Date = new Date(),
): KeywordChange => {
   if (days !== 'all') {
      const exact = changeSince(history, currentPosition, days, now);
      if (exact.change !== null) { return exact; }
   }
   const points = historyPoints(history);
   if (points.length < 2) { return { change: null, position: null }; }
   const first = points[0].position;
   if (first === 0 && currentPosition === 0) { return { change: 0, position: 0 }; }
   return { change: normalize(first) - normalize(currentPosition), position: first };
};
