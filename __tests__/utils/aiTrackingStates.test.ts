/** @jest-environment node */
import { AI_NOT_MEASURED, citationRatio, flat } from '../../utils/aiTracking';

describe('estado no medido', () => {
   it('vale -3 y no cuenta como oportunidad', () => {
      expect(AI_NOT_MEASURED).toBe(-3);
      const now = new Date(2026, 10, 30);
      const rows = Array.from({ length: 30 }, (_, i) => ({ date: `2026-11-${i + 1}`, ai_cited: i < 2 ? 1 : AI_NOT_MEASURED }));
      const r = citationRatio(rows, 30, now);
      expect(r && r.withAi).toBe(2);
      expect(r && r.cited).toBe(2);
   });
   it('flat quita acentos: AMMÔ Store → ammostore', () => {
      expect(flat('AMMÔ Store')).toBe('ammostore');
   });
});
