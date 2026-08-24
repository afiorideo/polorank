/**
 * PoloRank — pure aggregation of api_usage rows for the "Consumo" panel (no DB, unit-tested).
 */
export type UsageRow = {
   created_at: string,
   scraper: string,
   domain: string,
   keyword_id: number,
   keyword: string,
   depth: number,
   cost_usd: number,
   triggered_by: string,
   status: string,
};

export type UsageUser = { ID: number, email: string, role: string, domain: string | null, active: boolean };
export type UsageDomain = { domain: string, keywordCount: number };

export type UsageTotals = { calls: number, cost: number, errors: number };

export type UsageByDomain = UsageTotals & { domain: string, keywords: number, cronCalls: number, manualCalls: number };

export type UsageByUser = UsageTotals & {
   ID: number,
   email: string,
   role: string,
   domain: string | null,
   active: boolean,
   /** cost of the manual refreshes this user triggered (subset of `cost`) */
   manualCost: number,
   manualCalls: number,
};

export type UsageSummary = {
   from: string,
   to: string,
   totals: UsageTotals,
   /** average daily cost in the period × days of the month (only when the period is the current month) */
   projectedMonth: number | null,
   byDomain: UsageByDomain[],
   byUser: UsageByUser[],
   byDay: { date: string, calls: number, cost: number }[],
};

const round = (n: number) => Math.round(n * 1000000) / 1000000;

const inRange = (row: UsageRow, from: Date, to: Date): boolean => {
   const t = new Date(row.created_at).getTime();
   return Number.isFinite(t) && t >= from.getTime() && t <= to.getTime();
};

/** 'user:12' → 12 · anything else → null (cron / legacy 'manual') */
export const triggeredByUserId = (triggeredBy: string | undefined | null): number | null => {
   if (!triggeredBy || !triggeredBy.startsWith('user:')) { return null; }
   const id = parseInt(triggeredBy.slice(5), 10);
   return Number.isFinite(id) ? id : null;
};

export const isManual = (triggeredBy: string | undefined | null): boolean => !!triggeredBy && triggeredBy !== 'cron';

/** First/last instant of the month containing `date` (local time). */
export const monthBounds = (date: Date): { from: Date, to: Date } => ({
   from: new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0),
   to: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999),
});

export const summarizeUsage = (
   rows: UsageRow[],
   from: Date,
   to: Date,
   users: UsageUser[],
   domains: UsageDomain[],
   now: Date = new Date(),
): UsageSummary => {
   const period = rows.filter((r) => inRange(r, from, to));
   const totals: UsageTotals = { calls: period.length, cost: 0, errors: 0 };
   const domMap: { [d: string]: UsageByDomain } = {};
   const dayMap: { [d: string]: { date: string, calls: number, cost: number } } = {};
   domains.forEach((d) => {
      domMap[d.domain] = { domain: d.domain, keywords: d.keywordCount, calls: 0, cost: 0, errors: 0, cronCalls: 0, manualCalls: 0 };
   });

   period.forEach((r) => {
      const cost = Number(r.cost_usd) || 0;
      totals.cost += cost;
      if (r.status === 'error') { totals.errors += 1; }
      if (!domMap[r.domain]) { domMap[r.domain] = { domain: r.domain, keywords: 0, calls: 0, cost: 0, errors: 0, cronCalls: 0, manualCalls: 0 }; }
      const d = domMap[r.domain];
      d.calls += 1; d.cost += cost; if (r.status === 'error') { d.errors += 1; }
      if (isManual(r.triggered_by)) { d.manualCalls += 1; } else { d.cronCalls += 1; }
      const day = r.created_at.slice(0, 10);
      if (!dayMap[day]) { dayMap[day] = { date: day, calls: 0, cost: 0 }; }
      dayMap[day].calls += 1; dayMap[day].cost += cost;
   });

   const byUser: UsageByUser[] = users.map((u) => {
      const own = u.role === 'superadmin' ? period : period.filter((r) => u.domain && r.domain === u.domain);
      const manual = period.filter((r) => triggeredByUserId(r.triggered_by) === u.ID);
      return {
         ID: u.ID,
         email: u.email,
         role: u.role,
         domain: u.domain,
         active: u.active,
         calls: own.length,
         cost: round(own.reduce((a, r) => a + (Number(r.cost_usd) || 0), 0)),
         errors: own.filter((r) => r.status === 'error').length,
         manualCalls: manual.length,
         manualCost: round(manual.reduce((a, r) => a + (Number(r.cost_usd) || 0), 0)),
      };
   });

   // projection only makes sense for the running month
   const { from: mFrom, to: mTo } = monthBounds(now);
   let projectedMonth: number | null = null;
   if (from.getTime() === mFrom.getTime() && to.getTime() === mTo.getTime()) {
      const daysElapsed = Math.max(1, now.getDate());
      const daysInMonth = mTo.getDate();
      projectedMonth = round((totals.cost / daysElapsed) * daysInMonth);
   }

   return {
      from: from.toJSON(),
      to: to.toJSON(),
      totals: { ...totals, cost: round(totals.cost) },
      projectedMonth,
      byDomain: Object.values(domMap).map((d) => ({ ...d, cost: round(d.cost) })).sort((a, b) => b.cost - a.cost || a.domain.localeCompare(b.domain)),
      byUser: byUser.sort((a, b) => b.cost - a.cost || a.email.localeCompare(b.email)),
      byDay: Object.values(dayMap).map((d) => ({ ...d, cost: round(d.cost) })).sort((a, b) => a.date.localeCompare(b.date)),
   };
};

/** CSV export of the raw rows in the period (Excel-friendly, UTF-8). */
export const usageToCsv = (rows: UsageRow[]): string => {
   const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
   const head = ['fecha', 'dominio', 'keyword', 'profundidad', 'costo_usd', 'origen', 'estado', 'scraper'].join(',');
   const lines = rows.map((r) => [r.created_at, r.domain, r.keyword, r.depth, Number(r.cost_usd) || 0, r.triggered_by, r.status, r.scraper]
      .map(esc)
      .join(','));
   return [head, ...lines].join('\n');
};
