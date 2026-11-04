/** @jest-environment node */
import { sanitizeAiSettings } from '../../../utils/aiVisibility/config';

it('acota y normaliza lo que llega del cliente', () => {
   const s = sanitizeAiSettings({
      enabled: 'yes',
      brand_variants: [' Ammo ', '', 5, 'x'.repeat(300)],
      competitors: [{ name: 'Karo', variants: ['k', 3] }, { name: 7 }, null],
      location_code: -3,
      gemini_location_code: 2152,
      language_code: 'fr',
      country_iso: 'cl',
   }, 'ammo.cl');
   expect(s.enabled).toBe(false);
   expect(s.brand_variants).toEqual(['Ammo', 'x'.repeat(100)]);
   expect(s.competitors).toEqual([{ name: 'Karo', variants: ['k'] }]);
   expect(s.location_code).toBe(2152);
   expect(s.gemini_location_code).toBe(2152);
   expect(s.language_code).toBe('es');
   expect(s.country_iso).toBe('CL');
   expect(s.brand_urls).toEqual(['ammo.cl']);
});

it('sin variantes de marca queda vacío (la ruta responde 400) y limita a 10 y 30', () => {
   expect(sanitizeAiSettings({}, 'ammo.cl').brand_variants).toEqual([]);
   const s = sanitizeAiSettings({
      brand_variants: Array.from({ length: 20 }, (_, i) => `v${i}`),
      competitors: Array.from({ length: 40 }, (_, i) => ({ name: `c${i}`, variants: [] })),
   }, 'ammo.cl');
   expect(s.brand_variants).toHaveLength(10);
   expect(s.competitors).toHaveLength(30);
});
