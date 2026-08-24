import {
   averagePosition, bestPosition, changeSince, historyKey, monthlySummary, notFoundLabel, positionAt, resultsReceived, sliceHistory,
   summarizeHistory, trendOf, chartSeries, rangeChange,
} from '../../utils/history';

// "Today" fixed for deterministic tests
const NOW = new Date(2026, 7, 24); // 24-ago-2026

/** Build a history with one point per day going back `days` days: position = fn(daysAgo) */
const buildHistory = (days: number, fn: (daysAgo: number) => number): KeywordHistory => {
   const h: KeywordHistory = {};
   for (let i = days; i >= 0; i -= 1) {
      const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - i);
      h[historyKey(d)] = fn(i);
   }
   return h;
};

describe('utils/history (PoloRank)', () => {
   it('positionAt encuentra el punto más cercano dentro de ±3 días y null si no hay dato', () => {
      const h = { '2026-7-25': 14, '2026-8-24': 5 }; // hace 30 días exacto y hoy
      expect(positionAt(h, 30, NOW)?.position).toBe(14);
      expect(positionAt(h, 32, NOW)?.position).toBe(14); // 2 días de tolerancia
      expect(positionAt(h, 60, NOW)).toBeNull();
      expect(positionAt({}, 7, NOW)).toBeNull();
   });

   it('changeSince: positivo = mejoró, negativo = bajó, 0 = igual; fuera del top cuenta como 101', () => {
      const h = { '2026-7-25': 14, '2026-8-17': 2, '2026-8-24': 5 };
      expect(changeSince(h, 5, 30, NOW)).toEqual({ change: 9, position: 14 });
      expect(changeSince(h, 5, 7, NOW)).toEqual({ change: -3, position: 2 });
      expect(changeSince(h, 5, 0, NOW)).toEqual({ change: 0, position: 5 });
      expect(changeSince(h, 0, 30, NOW)).toEqual({ change: 14 - 101, position: 14 });
      expect(changeSince({ '2026-7-25': 0 }, 12, 30, NOW)).toEqual({ change: 101 - 12, position: 0 });
      expect(changeSince({ '2026-7-25': 0 }, 0, 30, NOW)).toEqual({ change: 0, position: 0 });
      expect(changeSince(h, 5, 90, NOW)).toEqual({ change: null, position: null });
   });

   it('bestPosition ignora los 0 y devuelve la primera fecha del mejor valor', () => {
      expect(bestPosition({ '2026-8-1': 0, '2026-8-2': 7, '2026-8-3': 3, '2026-8-4': 3 })).toEqual({ position: 3, date: '2026-8-3' });
      expect(bestPosition({ '2026-8-1': 0 })).toBeNull();
      expect(bestPosition(undefined)).toBeNull();
   });

   it('resultsReceived cuenta solo resultados reales y notFoundLabel arma el "+N"', () => {
      const last = [
         { position: 1, url: 'a', title: 'a' },
         { position: 2, url: 'b', title: 'b' },
         { position: 3, url: '', title: '', skipped: true },
      ];
      expect(resultsReceived(last)).toBe(2);
      expect(notFoundLabel(18, 20)).toBe('+20'); // manda la profundidad pedida, no lo recibido
      expect(notFoundLabel(47, 50)).toBe('+50');
      expect(notFoundLabel(18)).toBe('+20'); // sin profundidad conocida: redondea lo recibido a la decena
      expect(notFoundLabel(0)).toBe('+100');
   });

   it('summarizeHistory arma mejor, cambios 7/30/60/90 y días con datos', () => {
      const h = buildHistory(100, (daysAgo) => (daysAgo > 90 ? 0 : 50 - Math.floor(daysAgo / 3)));
      const s = summarizeHistory(h, h[historyKey(NOW)], [], NOW);
      expect(s.historyDays).toBe(101);
      expect(s.best?.position).toBe(20); // hoy: 50 - 30 = 20
      expect(s.changes.d7.change).toBe(-2); // hace 7 días: 48 → hoy 50? no: hoy = 50 - 0 = 50; hace 7 = 50 - 2 = 48 → 48 - 50 = -2
      expect(s.changes.d90.position).toBe(20);
      expect(s.changes.d90.change).toBe(20 - 50);
   });

   it('trendOf clasifica subiendo / bajando / igual / sin dato', () => {
      const s = summarizeHistory({ '2026-7-25': 14, '2026-8-24': 5 }, 5, [], NOW);
      expect(trendOf(s, 30)).toBe('up');
      expect(trendOf(s, 90)).toBe('none');
      const down = summarizeHistory({ '2026-7-25': 2, '2026-8-24': 5 }, 5, [], NOW);
      expect(trendOf(down, 30)).toBe('down');
      expect(trendOf(summarizeHistory({ '2026-7-25': 5, '2026-8-24': 5 }, 5, [], NOW), 30)).toBe('same');
   });

   it('sliceHistory conserva solo los últimos N días', () => {
      const h = buildHistory(60, () => 3);
      expect(Object.keys(sliceHistory(h, 30, NOW))).toHaveLength(31);
      expect(Object.keys(sliceHistory(h, 7, NOW))).toHaveLength(8);
   });

   it('monthlySummary agrupa por mes (más reciente primero) con mejor/promedio/peor/cambio y días sin encontrar', () => {
      const h: KeywordHistory = {
         '2026-6-10': 30,
'2026-6-20': 20,
         '2026-7-5': 12,
'2026-7-15': 0,
'2026-7-25': 18,
         '2026-8-1': 10,
'2026-8-24': 6,
      };
      const m = monthlySummary(h);
      expect(m.map((x) => x.month)).toEqual(['2026-08', '2026-07', '2026-06']);
      expect(m[0]).toMatchObject({ label: 'Ago 2026', best: 6, avg: 8, worst: 10, days: 2, notFoundDays: 0 });
      expect(m[1]).toMatchObject({ label: 'Jul 2026', best: 12, avg: 15, worst: 18, days: 3, notFoundDays: 1, change: 10 });
      expect(m[2]).toMatchObject({ label: 'Jun 2026', best: 20, avg: 25, worst: 30, change: null });
      expect(m[0].change).toBe(7); // 15 → 8
      expect(monthlySummary({})).toEqual([]);
   });

   it('averagePosition promedia solo días encontrados dentro del rango', () => {
      expect(averagePosition({ '2026-8-20': 4, '2026-8-22': 0, '2026-8-24': 6, '2026-6-1': 50 }, 30, NOW)).toBe(5);
      expect(averagePosition({ '2026-8-22': 0 }, 30, NOW)).toBeNull();
   });

   it('chartSeries recorta al primer dato, arrastra días sin scrape y deja hueco cuando no aparece', () => {
      const h = { '2026-8-20': 4, '2026-8-22': 0, '2026-8-24': 6 };
      const c = chartSeries(h, 30, NOW);
      expect(c.labels).toEqual(['20 ago', '21 ago', '22 ago', '23 ago', '24 ago']);
      expect(c.series).toEqual([4, 4, null, null, 6]);
      expect(chartSeries({}, 30, NOW)).toEqual({ labels: [], series: [] });
      expect(chartSeries(h, 'all', NOW).labels).toHaveLength(5);
   });

   it('rangeChange usa N días atrás si hay dato y, si no, el primer punto del historial', () => {
      const h = { '2026-8-12': 9, '2026-8-24': 2 };
      expect(rangeChange(h, 2, 180, NOW)).toEqual({ change: 7, position: 9 });
      expect(rangeChange({ '2026-7-25': 14, '2026-8-24': 5 }, 5, 30, NOW)).toEqual({ change: 9, position: 14 });
      expect(rangeChange({ '2026-8-24': 5 }, 5, 30, NOW)).toEqual({ change: null, position: null });
   });
});
