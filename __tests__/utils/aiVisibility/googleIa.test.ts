/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { extractLocalPack, extractPaa } from '../../../utils/aiVisibility/googleIa';

const load = (n: number) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../fixtures/ai', `dfs-${n}.json`), 'utf8'))[0].items;
const items = load(2);

describe('datos extra de la página de Google', () => {
   it('Local Pack presente con negocios (bloque local_pack real de la fixture)', () => {
      expect(items.some((i: any) => i.type === 'local_pack')).toBe(true);
      const lp = extractLocalPack(items, 'ammo.cl');
      expect(lp.items.length).toBeGreaterThan(0);
      expect(lp.items[0].domain).toBe('armariodelakaro.cl');
      expect(typeof lp.position).toBe('number');
      expect(lp.present).toBe(false);
      expect(lp.position).toBe(0);
   });
   it('detecta la posición del dominio dentro del Local Pack', () => {
      const lp = extractLocalPack(items, 'www.chocolateamargo.cl');
      expect(lp.present).toBe(true);
      expect(lp.position).toBe(3);
   });
   it('PAA devuelve un arreglo de textos', () => {
      expect(Array.isArray(extractPaa(items))).toBe(true);
      expect(extractPaa([{ type: 'people_also_ask', items: [{ title: '¿Qué es?' }, {}] }])).toEqual(['¿Qué es?']);
   });
});
