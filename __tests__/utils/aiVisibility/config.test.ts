/** @jest-environment node */
import { parseAiSettings, targetFor } from '../../../utils/aiVisibility/config';
import { weekOf } from '../../../utils/aiVisibility/week';
import { estimateCost } from '../../../utils/aiVisibility/budget';

describe('config IA', () => {
   it('valores por defecto desde el dominio', () => {
      const c = parseAiSettings('', 'ammo.cl');
      expect(c.enabled).toBe(false);
      expect(c.brand_variants).toEqual(['ammo']);
      expect(c.brand_urls).toEqual(['ammo.cl']);
      expect(c.location_code).toBe(2152);
   });
   it('override por prompt (Emignia desde Brasil)', () => {
      const c = parseAiSettings(JSON.stringify({ enabled: true, location_code: 2152, language_code: 'es', country_iso: 'CL' }), 'emignia.com');
      expect(targetFor(c, { location_code: 2076, language_code: 'pt', country_iso: 'BR' })).toEqual({ location_code: 2076, gemini_location_code: 2076, language_code: 'pt', country_iso: 'BR' });
   });
   it('Gemini usa la región si existe', () => {
      const c = parseAiSettings(JSON.stringify({ gemini_location_code: 20153 }), 'ammo.cl');
      expect(targetFor(c, {}).gemini_location_code).toBe(20153);
   });
});

describe('semana y costo', () => {
   it('weekOf devuelve el lunes', () => {
      expect(weekOf(new Date('2026-11-04T12:00:00Z'))).toBe('2026-11-02');
      expect(weekOf(new Date('2026-11-09T09:00:00Z'))).toBe('2026-11-09');
   });
   it('estimado semanal de Ammo (5 prompts, 8 keywords) ≈ US$0,21', () => {
      expect(estimateCost(5, 8, 'queue')).toBeCloseTo(0.208, 2);
   });
});
