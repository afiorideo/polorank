import { isManual, monthBounds, summarizeUsage, triggeredByUserId, usageToCsv, UsageRow } from '../../utils/usageSummary';

const NOW = new Date(2026, 7, 24, 12); // 24-ago-2026
const row = (over: Partial<UsageRow>): UsageRow => ({
   created_at: '2026-08-24T10:00:00.000Z',
   scraper: 'dataforseo',
   domain: 'ammo.cl',
   keyword_id: 1,
   keyword: 'kw',
   depth: 20,
   cost_usd: 0.004,
   triggered_by: 'cron',
   status: 'ok',
   ...over,
});

const users = [
   { ID: 1, email: 'afiorid@gmail.com', role: 'superadmin', domain: null, active: true },
   { ID: 2, email: 'admin@ammo.cl', role: 'domain_admin', domain: 'ammo.cl', active: true },
   { ID: 3, email: 'ver@mavae.cl', role: 'domain_user', domain: 'mavae.cl', active: false },
];
const domains = [{ domain: 'ammo.cl', keywordCount: 3 }, { domain: 'mavae.cl', keywordCount: 5 }, { domain: 'emignia.com', keywordCount: 2 }];

describe('usageSummary (PoloRank · panel de consumo)', () => {
   it('helpers: origen de la consulta y límites del mes', () => {
      expect(triggeredByUserId('user:12')).toBe(12);
      expect(triggeredByUserId('cron')).toBeNull();
      expect(triggeredByUserId('manual')).toBeNull();
      expect(isManual('cron')).toBe(false);
      expect(isManual('user:1')).toBe(true);
      expect(isManual('manual')).toBe(true);
      const { from, to } = monthBounds(NOW);
      expect(from.getDate()).toBe(1);
      expect(to.getDate()).toBe(31);
   });

   it('agrega totales, por dominio y por usuario dentro del período', () => {
      const rows = [
         row({}), row({ keyword: 'kw2' }), row({ domain: 'mavae.cl', cost_usd: 0.006, triggered_by: 'user:1' }),
         row({ domain: 'ammo.cl', cost_usd: 0.002, status: 'error', triggered_by: 'user:2' }),
         row({ created_at: '2026-07-30T10:00:00.000Z', cost_usd: 1 }), // fuera del período
      ];
      const { from, to } = monthBounds(NOW);
      const s = summarizeUsage(rows, from, to, users, domains, NOW);
      expect(s.totals).toEqual({ calls: 4, cost: 0.016, errors: 1 });
      expect(s.projectedMonth).toBeCloseTo((0.016 / 24) * 31, 6);
      const ammo = s.byDomain.find((d) => d.domain === 'ammo.cl')!;
      expect(ammo).toMatchObject({ keywords: 3, calls: 3, cost: 0.01, errors: 1, cronCalls: 2, manualCalls: 1 });
      expect(s.byDomain.find((d) => d.domain === 'emignia.com')).toMatchObject({ calls: 0, cost: 0, keywords: 2 });
      const admin = s.byUser.find((u) => u.ID === 1)!;
      expect(admin).toMatchObject({ calls: 4, cost: 0.016, manualCalls: 1, manualCost: 0.006 });
      const ammoAdmin = s.byUser.find((u) => u.ID === 2)!;
      expect(ammoAdmin).toMatchObject({ calls: 3, cost: 0.01, manualCalls: 1, manualCost: 0.002 });
      expect(s.byUser.find((u) => u.ID === 3)).toMatchObject({ calls: 1, cost: 0.006, manualCalls: 0, active: false });
      expect(s.byDay).toEqual([{ date: '2026-08-24', calls: 4, cost: 0.016 }]);
   });

   it('no proyecta cuando el período no es el mes en curso', () => {
      const s = summarizeUsage([row({})], new Date(2026, 6, 1), new Date(2026, 6, 31, 23, 59, 59), users, domains, NOW);
      expect(s.projectedMonth).toBeNull();
      expect(s.totals.calls).toBe(0);
   });

   it('usageToCsv exporta cabecera y filas escapadas', () => {
      const csv = usageToCsv([row({ keyword: 'vestidos "de" fiesta' })]);
      const lines = csv.split('\n');
      expect(lines[0]).toBe('fecha,dominio,keyword,profundidad,costo_usd,origen,estado,scraper');
      expect(lines[1]).toContain('"vestidos ""de"" fiesta"');
      expect(lines[1]).toContain('"0.004"');
   });
});
