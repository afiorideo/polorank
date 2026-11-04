/** @jest-environment node */
import { lastSerpTrusted } from '../../utils/aiTracking';

describe('lastSerpTrusted (insignia "no confiable")', () => {
   it('sin filas o sin serp_trust informado es confiable', () => {
      expect(lastSerpTrusted([])).toBe(true);
      expect(lastSerpTrusted([{ serp_trust: null }, { serp_trust: null }])).toBe(true);
   });
   it('el lunes no confiable sigue marcado aunque después vengan filas de Serper (serp_trust null)', () => {
      expect(lastSerpTrusted([{ serp_trust: 1 }, { serp_trust: 0 }, { serp_trust: null }, { serp_trust: null }])).toBe(false);
   });
   it('una medición confiable posterior limpia la marca', () => {
      expect(lastSerpTrusted([{ serp_trust: 0 }, { serp_trust: null }, { serp_trust: 1 }, { serp_trust: null }])).toBe(true);
   });
});
