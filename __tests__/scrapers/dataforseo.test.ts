import dataforseo, { extractCost, extractFeatures, extractOrganic, normalizeDepth, parseCredentials } from '../../scrapers/services/dataforseo';
import countries from '../../utils/countries';
import fixture from './fixtures/dataforseo-response.json';

const keyword: KeywordType = {
   ID: 1,
   keyword: 'vestidos de fiesta temuco',
   device: 'mobile',
   country: 'CL',
   domain: 'ammo.cl',
   lastUpdated: '',
   added: '',
   position: 2,
   volume: 590,
   sticky: false,
   history: {},
   lastResult: [],
   url: '',
   tags: [],
   updating: false,
   lastUpdateError: false,
};

const settings = { scraper_type: 'dataforseo', scaping_api: 'usuario@correo.com:clave123' } as SettingsType;

describe('DataForSEO scraper (PoloRank)', () => {
   it('parseCredentials separa login:password y rechaza formatos inválidos', () => {
      expect(parseCredentials('a@b.com:secreto')).toEqual({ login: 'a@b.com', password: 'secreto' });
      expect(parseCredentials('a@b.com:se:cre:to')).toEqual({ login: 'a@b.com', password: 'se:cre:to' });
      expect(parseCredentials('sin-separador')).toBeNull();
      expect(parseCredentials(':x')).toBeNull();
      expect(parseCredentials(undefined)).toBeNull();
   });

   it('normalizeDepth redondea a bloques de 10 dentro de 10..100', () => {
      expect(normalizeDepth(undefined)).toBe(10);
      expect(normalizeDepth(0)).toBe(10);
      expect(normalizeDepth(10)).toBe(10);
      expect(normalizeDepth(15)).toBe(20);
      expect(normalizeDepth(60)).toBe(60);
      expect(normalizeDepth(250)).toBe(100);
   });

   it('headers usa Basic auth con las credenciales del campo API', () => {
      const headers = dataforseo.headers!(keyword, settings) as { [k: string]: string };
      expect(headers.Authorization).toBe(`Basic ${Buffer.from('usuario@correo.com:clave123').toString('base64')}`);
      expect(headers['Content-Type']).toBe('application/json');
   });

   it('body arma la tarea con location_code de Chile, idioma, dispositivo y depth', () => {
      const body = JSON.parse(dataforseo.body!(keyword, settings, countries, { start: 0, num: 20, page: 1 }));
      expect(body).toHaveLength(1);
      expect(body[0]).toEqual({
         keyword: 'vestidos de fiesta temuco',
         language_code: 'es',
         device: 'mobile',
         os: 'android',
         depth: 20,
         location_code: 2152,
      });
   });

   it('body usa location_name cuando la keyword tiene ciudad', () => {
      const kw = { ...keyword, city: 'Temuco', device: 'desktop' };
      const body = JSON.parse(dataforseo.body!(kw, settings, countries, { start: 0, num: 10, page: 1 }));
      expect(body[0].location_name).toBe('Temuco,Chile');
      expect(body[0].location_code).toBeUndefined();
      expect(body[0].device).toBe('desktop');
      expect(body[0].os).toBe('windows');
   });

   it('extractOrganic devuelve solo orgánicos, ordenados y con posición secuencial', () => {
      const organic = extractOrganic(fixture);
      expect(organic.map((r) => r.position)).toEqual([1, 2, 3, 4]);
      expect(organic[0].url).toBe('https://www.competidor.cl/vestidos');
      expect(organic[1].url).toBe('https://ammo.cl/');
      expect(organic.every((r) => r.title && r.url)).toBe(true);
   });

   it('extractFeatures normaliza los tipos de bloque de la SERP sin repetir', () => {
      expect(extractFeatures(fixture)).toEqual(['people_also_ask', 'local_pack', 'video']);
   });

   it('extractCost lee el costo real de la respuesta', () => {
      expect(extractCost(fixture)).toBeCloseTo(0.002, 6);
      expect(extractCost({})).toBeUndefined();
   });

   it('extractOrganic lanza error con el mensaje de DataForSEO cuando la API falla', () => {
      expect(() => extractOrganic({ status_code: 40100, status_message: 'Login incorrect.', tasks: [] }))
         .toThrow('DataForSEO 40100: Login incorrect.');
      expect(() => extractOrganic({ status_code: 20000, tasks: [{ status_code: 40201, status_message: 'Balance is too low.' }] }))
         .toThrow('DataForSEO 40201: Balance is too low.');
   });

   it('está registrado como scraper POST basado en profundidad', () => {
      expect(dataforseo.id).toBe('dataforseo');
      expect(dataforseo.method).toBe('POST');
      expect(dataforseo.depthBased).toBe(true);
      expect(dataforseo.scrapeURL!(keyword, settings, countries)).toContain('serp/google/organic/live/advanced');
   });
});
