import { checkedDepth, scrapeDepthMeta } from '../../utils/depth';

const page = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => ({
   position: from + i, url: `https://sitio${from + i}.cl/`, title: `Resultado ${from + i}`,
}));

describe('resultados revisados con proveedores por páginas (POLO-2026-10-13-01)', () => {
   it('checkedDepth: 5 páginas completas → 50', () => {
      expect(checkedDepth(page(1, 50))).toBe(50);
   });

   it('checkedDepth: Google devuelve menos de 10 por página → redondea a la página revisada', () => {
      expect(checkedDepth(page(1, 9))).toBe(10);
      expect(checkedDepth([...page(1, 9), ...page(11, 47)])).toBe(50);
   });

   it('checkedDepth: ignora las posiciones marcadas como no revisadas y limita a 100', () => {
      const skipped = page(51, 100).map((r) => ({ ...r, url: '', skipped: true }));
      expect(checkedDepth([...page(1, 50), ...skipped])).toBe(50);
      expect(checkedDepth(page(1, 120))).toBe(100);
      expect(checkedDepth([])).toBe(0);
   });

   it('scrapeDepthMeta: DataForSEO conserva su profundidad y sus features', () => {
      expect(scrapeDepthMeta({ depth: 20, serpFeatures: ['images'] }))
         .toEqual({ lastDepth: 20, serpFeatures: ['images'], snapshotDepth: 20 });
   });

   it('scrapeDepthMeta: Serper (sin depth) usa los resultados revisados y no toca las features', () => {
      expect(scrapeDepthMeta({ checked: 50 })).toEqual({ lastDepth: 50, snapshotDepth: 50 });
   });

   it('scrapeDepthMeta: sin dato no actualiza la etiqueta', () => {
      expect(scrapeDepthMeta({})).toEqual({ snapshotDepth: 0 });
      expect(scrapeDepthMeta({ checked: 0 })).toEqual({ snapshotDepth: 0 });
   });
});
