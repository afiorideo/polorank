/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { ENGINE_DEF } from '../../../utils/aiVisibility/engines';

const res = (f: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../fixtures/ai', f), 'utf8')).tasks[0].result[0];

describe('parsers por motor (respuestas reales del piloto)', () => {
   it('ChatGPT: texto, fuentes con ammo.cl, búsquedas internas y marcas en orden', () => {
      const p = ENGINE_DEF.chatgpt.parse(res('chatgpt-venta-1.json'));
      expect(p.text).toContain('Ammo');
      expect(p.sources.some((s) => s.domain === 'ammo.cl')).toBe(true);
      expect(p.fanOut.length).toBeGreaterThan(0);
      expect(p.entities.slice(0, 2)).toEqual(['Armario de la Karo', 'Ammo Store (AMMÔ)']);
   });
   it('Gemini: texto y fuentes', () => {
      const p = ENGINE_DEF.gemini.parse(res('gemini-arriendo-1.json'));
      expect(p.text).toContain('Ammo Store');
      expect(p.sources.some((s) => s.domain === 'ammo.cl')).toBe(true);
   });
   it('Perplexity: texto de las secciones y resultados de búsqueda', () => {
      const p = ENGINE_DEF.perplexity.parse(res('perplexity-venta-1.json'));
      expect(p.text).toContain('Armario de la Karo');
      expect(p.sources.length).toBeGreaterThan(0);
   });
   it('AI Mode: texto y referencias (fixture de la Task 1)', () => {
      const p = ENGINE_DEF.ai_mode.parse(res('ai-mode-ammo.json'));
      expect(p.text.length).toBeGreaterThan(50);
      expect(p.sources.length).toBeGreaterThan(0);
   });
   it('tareas con la ubicación correcta', () => {
      const t = { location_code: 2152, gemini_location_code: 20153, language_code: 'es', country_iso: 'CL' };
      expect(ENGINE_DEF.gemini.task('hola', t)).toEqual({ keyword: 'hola', location_code: 20153, language_code: 'es' });
      expect(ENGINE_DEF.perplexity.task('hola', t)).toEqual({ user_prompt: 'hola', model_name: 'sonar', web_search_country_iso_code: 'CL' });
   });
   it('portugués: Gemini y AI Mode solo aceptan pt-BR; ChatGPT sigue con pt (corrida 2026-11-09, 40401)', () => {
      const t = { location_code: 2076, gemini_location_code: 2076, language_code: 'pt', country_iso: 'BR' };
      expect(ENGINE_DEF.gemini.task('olá', t)).toMatchObject({ language_code: 'pt-BR' });
      expect(ENGINE_DEF.ai_mode.task('olá', t)).toMatchObject({ language_code: 'pt-BR' });
      expect(ENGINE_DEF.chatgpt.task('olá', t)).toMatchObject({ language_code: 'pt' });
      expect(ENGINE_DEF.ai_mode.task('hola', { ...t, language_code: 'es' })).toMatchObject({ language_code: 'es' });
   });
});
