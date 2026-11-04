/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { isGotoUrl, gotoCredentials, resolveGotoUrls, gotoIncompleteReason } from '../../utils/gotoResolver';
import { extractOrganic } from '../../scrapers/services/dataforseo';

const fx = (f: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../scrapers/fixtures', f), 'utf8'));
const serp = fx('serp-goto-ammo-movil.json');
const converter = fx('goto-converter-ammo-movil.json');
const CREDS = 'user@x.cl:secret';

beforeEach(() => { fetchMock.resetMocks(); });

describe('isGotoUrl', () => {
   it('reconoce goto con y sin www, y rechaza URLs normales', () => {
      expect(isGotoUrl('https://google.com/goto?url=CAES')).toBe(true);
      expect(isGotoUrl('https://www.google.com/goto?url=CAES')).toBe(true);
      expect(isGotoUrl('https://ammo.cl/')).toBe(false);
      expect(isGotoUrl('https://www.google.com/search?q=goto')).toBe(false);
      expect(isGotoUrl(undefined)).toBe(false);
   });
});

describe('gotoCredentials', () => {
   it('usa el campo API cuando el proveedor es DataForSEO', () => {
      expect(gotoCredentials({ scraper_type: 'dataforseo', scaping_api: CREDS })).toBe(CREDS);
   });
   it('con otro proveedor usa DATAFORSEO_GOTO_CREDENTIALS, o vacío', () => {
      delete process.env.DATAFORSEO_GOTO_CREDENTIALS;
      expect(gotoCredentials({ scraper_type: 'serper', scaping_api: 'serper-key' })).toBe('');
      process.env.DATAFORSEO_GOTO_CREDENTIALS = CREDS;
      expect(gotoCredentials({ scraper_type: 'serper', scaping_api: 'serper-key' })).toBe(CREDS);
      delete process.env.DATAFORSEO_GOTO_CREDENTIALS;
   });
   it('con otro proveedor usa ai_dataforseo_credentials antes que la variable de entorno', () => {
      process.env.DATAFORSEO_GOTO_CREDENTIALS = 'env@x.cl:e';
      expect(gotoCredentials({ scraper_type: 'serper', scaping_api: 'k', ai_dataforseo_credentials: CREDS } as any)).toBe(CREDS);
      delete process.env.DATAFORSEO_GOTO_CREDENTIALS;
   });
});

describe('resolveGotoUrls (respuesta real de Ammo, móvil, 2026-10-31)', () => {
   const organic = () => extractOrganic(serp);

   it('el fixture trae ammo.cl escondido en el puesto 2 como goto', () => {
      expect(organic()).toHaveLength(9);
      expect(isGotoUrl(organic()[1].url)).toBe(true);
   });

   it('resuelve los 6 goto en UNA llamada y deja ammo.cl en el puesto 2', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(converter));
      const out = await resolveGotoUrls(organic(), CREDS);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.dataforseo.com/v3/appendix/goto_url_converter');
      expect(JSON.parse(String(init?.body))[0].goto_urls).toHaveLength(6);
      expect(out.unresolved).toEqual([]);
      expect(out.results[1].url).toBe('https://ammo.cl/');
      expect(out.results.every((r) => !isGotoUrl(r.url))).toBe(true);
   });

   it('quita el parámetro de rastreo srsltid de la URL resuelta', async () => {
      const conv = { tasks: [{ status_code: 20000, result: [{ goto: organic()[1].url, url: 'https://ammo.cl/?srsltid=AYCX9v' }] }] };
      fetchMock.mockResponseOnce(JSON.stringify(conv));
      const out = await resolveGotoUrls(organic(), CREDS);
      expect(out.results[1].url).toBe('https://ammo.cl/');
   });

   it('sin goto no llama al convertidor', async () => {
      const plain = [{ title: 'a', url: 'https://ammo.cl/', position: 1 }];
      const out = await resolveGotoUrls(plain, CREDS);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(out).toEqual({ results: plain, unresolved: [] });
   });

   it('si el convertidor falla, devuelve los puestos que siguen como goto', async () => {
      fetchMock.mockRejectOnce(new Error('timeout'));
      const out = await resolveGotoUrls(organic(), CREDS);
      expect(out.unresolved).toEqual([2, 3, 6, 7, 8, 9]);
   });

   it('sin credenciales no llama y devuelve todos los goto como sin resolver', async () => {
      const out = await resolveGotoUrls(organic(), '');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(out.unresolved).toEqual([2, 3, 6, 7, 8, 9]);
   });

   it('parte en lotes de 100', async () => {
      const many = Array.from({ length: 150 }, (_, i) => ({ title: `t${i}`, url: `https://google.com/goto?url=X${i}`, position: i + 1 }));
      fetchMock.mockResponse(JSON.stringify({ tasks: [{ status_code: 20000, result: [] }] }));
      await resolveGotoUrls(many, CREDS);
      expect(fetchMock).toHaveBeenCalledTimes(2);
   });
});

describe('gotoIncompleteReason', () => {
   it('nada pendiente → null', () => { expect(gotoIncompleteReason(0, [])).toBeNull(); });
   it('dominio encontrado y los goto pendientes están DESPUÉS → null', () => { expect(gotoIncompleteReason(2, [5, 7])).toBeNull(); });
   it('dominio encontrado pero un goto pendiente ANTES → motivo', () => {
      expect(gotoIncompleteReason(5, [2, 7])).toContain('puestos 2');
   });
   it('dominio no encontrado con goto pendientes → motivo', () => {
      expect(gotoIncompleteReason(0, [3])).toContain('google.com/goto');
   });
});
