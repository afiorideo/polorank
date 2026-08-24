import { strategyToDepth } from '../../utils/depth';

describe('strategyToDepth (PoloRank)', () => {
   it('basic → siempre 10', () => {
      expect(strategyToDepth('basic', 5, 0)).toBe(10);
      expect(strategyToDepth('basic', 5, 46)).toBe(10);
      expect(strategyToDepth('', 5, 46)).toBe(10);
      expect(strategyToDepth(undefined, 5, 46)).toBe(10);
   });

   it('custom → N páginas × 10, acotado a 1..10 páginas', () => {
      expect(strategyToDepth('custom', 1, 0)).toBe(10);
      expect(strategyToDepth('custom', 3, 0)).toBe(30);
      expect(strategyToDepth('custom', 10, 0)).toBe(100);
      expect(strategyToDepth('custom', 15, 0)).toBe(100);
      expect(strategyToDepth('custom', 0, 0)).toBe(10);
   });

   it('smart → keyword nueva (0) pide solo la primera página', () => {
      expect(strategyToDepth('smart', 5, 0)).toBe(10);
   });

   it('smart → hasta la página siguiente a la última posición conocida', () => {
      expect(strategyToDepth('smart', 5, 2)).toBe(20);
      expect(strategyToDepth('smart', 5, 10)).toBe(20);
      expect(strategyToDepth('smart', 5, 11)).toBe(30);
      expect(strategyToDepth('smart', 5, 46)).toBe(60);
      expect(strategyToDepth('smart', 5, 95)).toBe(100);
      expect(strategyToDepth('smart', 5, 100)).toBe(100);
   });
});
