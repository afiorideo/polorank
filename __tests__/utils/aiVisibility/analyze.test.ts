/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { ENGINE_DEF } from '../../../utils/aiVisibility/engines';
import { analyzeAnswer, newCompetitors } from '../../../utils/aiVisibility/analyze';
import { parseAiSettings } from '../../../utils/aiVisibility/config';

const res = (f: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../fixtures/ai', f), 'utf8')).tasks[0].result[0];
const ammo = parseAiSettings(JSON.stringify({
   enabled: true, brand_variants: ['Ammo'], brand_urls: ['ammo.cl', 'instagram.com/ammostorechile'],
   competitors: [{ name: 'Armario de la Karo', variants: ['Armario de la Karo'] }, { name: 'Blanka Atelier', variants: ['Blanka'] }],
}), 'ammo.cl');

describe('analyzeAnswer', () => {
   it('ChatGPT venta: te nombra, te cita y quedas #2 detrás de Armario de la Karo', () => {
      const a = analyzeAnswer(ENGINE_DEF.chatgpt.parse(res('chatgpt-venta-1.json')), ammo);
      expect(a).toMatchObject({ mentioned: 1, cited: 1, position: 2 });
      expect(a.brands[0]).toBe('Armario de la Karo');
   });
   it('Claude escribe "Ammô Store" con acento y igual cuenta como nombrado', () => {
      const a = analyzeAnswer(ENGINE_DEF.perplexity.parse(res('claude-venta-1.json')), ammo);
      expect(a.mentioned).toBe(1);
      expect(a.cited).toBe(1); // instagram.com/ammostorechile
   });
   it('Perplexity: no te nombra ni te cita', () => {
      const a = analyzeAnswer(ENGINE_DEF.perplexity.parse(res('perplexity-venta-1.json')), ammo);
      expect(a).toMatchObject({ mentioned: 0, cited: 0, position: 0 });
      expect(a.brands).toContain('Armario de la Karo');
   });
   it('competidores nuevos de ChatGPT que no están configurados', () => {
      const p = ENGINE_DEF.chatgpt.parse(res('chatgpt-venta-1.json'));
      expect(newCompetitors(p.entities, ammo)).toEqual(expect.arrayContaining(['Jeannette Menard']));
      expect(newCompetitors(p.entities, ammo)).not.toContain('Ammo Store (AMMÔ)');
   });
   const src = [{ domain: 'ammo.cl', url: 'https://ammo.cl/', title: '' }];
   it('una etiqueta de dominio [ammo.cl](url) es cita, no mención', () => {
      const p = { text: 'Hay varias tiendas. [ammo.cl](https://ammo.cl/)', sources: src, fanOut: [], entities: [] };
      expect(analyzeAnswer(p, ammo)).toMatchObject({ mentioned: 0, cited: 1 });
   });
   it('una etiqueta con nombre [Ammo Store](url) sí es mención', () => {
      const p = { text: 'Prueba [Ammo Store](https://ammo.cl/).', sources: src, fanOut: [], entities: [] };
      expect(analyzeAnswer(p, ammo)).toMatchObject({ mentioned: 1, cited: 1 });
   });
   it('Gemini sin la marca en la prosa: solo cita', () => {
      const p0 = ENGINE_DEF.gemini.parse(res('gemini-arriendo-1.json'));
      const p = { ...p0, text: p0.text.replace(/Ammo Store/gi, 'Tienda X').replace(/\*ammo\.cl\*/g, 'su web') };
      const a = analyzeAnswer(p, ammo);
      expect(a.mentioned).toBe(0);
      expect(a.cited).toBe(1);
   });
   it('una URL pelada con la marca no cuenta como nombrada', () => {
      const p = { text: 'Más info en https://ammo.cl/tienda', sources: [], fanOut: [], entities: [] };
      expect(analyzeAnswer(p, ammo).mentioned).toBe(0);
   });
});
