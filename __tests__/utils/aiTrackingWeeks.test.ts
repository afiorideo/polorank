/** @jest-environment node */
import { citationPeriodsWeeks } from '../../utils/aiTracking';

it('las páginas no confiables no cuentan', () => {
   const now = new Date(2026, 11, 28);
   const rows = [
      { date: '2026-10-5', ai_cited: 1, serp_trust: 1 },
      { date: '2026-12-7', ai_cited: 1, serp_trust: 1 },
      { date: '2026-12-14', ai_cited: 0, serp_trust: 0 },
      { date: '2026-12-21', ai_cited: 0, serp_trust: 1 },
   ];
   const p = citationPeriodsWeeks(rows, now);
   expect(p.w4 && p.w4.withAi).toBe(2);
   expect(p.w4 && p.w4.cited).toBe(1);
});

it('las filas no medidas (-3) no cuentan como oportunidad', () => {
   const now = new Date(2026, 11, 28);
   const rows = [
      { date: '2026-10-5', ai_cited: 1, serp_trust: 1 },
      { date: '2026-12-7', ai_cited: -3, serp_trust: null },
      { date: '2026-12-21', ai_cited: 1, serp_trust: 1 },
   ];
   const p = citationPeriodsWeeks(rows, now);
   expect(p.w4 && p.w4.withAi).toBe(1);
   expect(p.w12 && p.w12.days).toBe(84);
});
