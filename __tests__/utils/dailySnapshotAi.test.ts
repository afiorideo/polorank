/** @jest-environment node */
import { aiFieldsFor } from '../../utils/dailySnapshot';
import { AI_NOT_MEASURED } from '../../utils/aiTracking';

describe('aiFieldsFor', () => {
   it('undefined + fila nueva → -3', () => {
      expect(aiFieldsFor(undefined, 'ammo.cl', 'ammo', false)).toEqual({ ai_cited: AI_NOT_MEASURED, ai_mentioned: AI_NOT_MEASURED, ai_references: '[]', ai_text: '' });
   });
   it('undefined + fila existente → no toca nada', () => {
      expect(aiFieldsFor(undefined, 'ammo.cl', 'ammo', true)).toEqual({});
   });
   it('null → -1 (midió y no hubo resumen)', () => {
      expect(aiFieldsFor(null, 'ammo.cl', 'ammo', true).ai_cited).toBe(-1);
   });
});
