/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { scrapeKeywordWithStrategy } from '../../utils/scraper';

const fx = (f: string) => fs.readFileSync(path.join(__dirname, '../scrapers/fixtures', f), 'utf8');

const keyword = {
   ID: 1, keyword: 'vestidos de fiesta temuco', device: 'mobile', country: 'CL', city: '', domain: 'ammo.cl',
   position: 2, url: 'https://ammo.cl/', lastResult: [], history: {}, tags: [], updating: false, lastUpdated: '',
   added: '', sticky: false, lastUpdateError: false,
} as unknown as KeywordType;

const settings = { scraper_type: 'dataforseo', scaping_api: 'user@x.cl:secret', scrape_strategy: 'basic' } as unknown as SettingsType;

beforeEach(() => { fetchMock.resetMocks(); });

describe('scrapeKeywordWithStrategy · DataForSEO con enlaces goto', () => {
   it('encuentra ammo.cl en el puesto 2 aunque venía como goto', async () => {
      fetchMock.mockResponses(fx('serp-goto-ammo-movil.json'), fx('goto-converter-ammo-movil.json'));
      const r = await scrapeKeywordWithStrategy(keyword, settings);
      expect(r && r.error).toBe(false);
      expect(r && r.position).toBe(2);
      expect(r && r.url).toBe('https://ammo.cl/');
      expect(fetchMock).toHaveBeenCalledTimes(2);
   });

   it('si el convertidor falla, devuelve error (no posición 0) y conserva la posición anterior', async () => {
      fetchMock.mockResponseOnce(fx('serp-goto-ammo-movil.json'));
      fetchMock.mockRejectOnce(new Error('timeout'));
      const r = await scrapeKeywordWithStrategy(keyword, settings);
      expect(r && r.error).toEqual(expect.stringContaining('google.com/goto'));
      expect(r && r.position).toBe(2);
      expect(r && typeof r.cost).toBe('number');
   });
});

describe('scrapeKeywordWithStrategy · Serper con enlaces goto', () => {
   const serperSettings = { scraper_type: 'serper', scaping_api: 'serper-key', scrape_strategy: 'basic' } as unknown as SettingsType;
   const GOTO = 'https://www.google.com/goto?url=CAESammo';
   const serperPage = JSON.stringify({ organic: [
      { title: 'Ammo Instagram', link: 'https://www.instagram.com/ammostorechile/', position: 1 },
      { title: 'Ammo Store', link: GOTO, position: 2 },
   ] });

   afterEach(() => { delete process.env.DATAFORSEO_GOTO_CREDENTIALS; });

   it('con credenciales de respaldo resuelve el goto y encuentra ammo.cl en el 2', async () => {
      process.env.DATAFORSEO_GOTO_CREDENTIALS = 'user@x.cl:secret';
      fetchMock.mockResponses(serperPage, JSON.stringify({ tasks: [{ status_code: 20000, result: [{ goto: GOTO, url: 'https://ammo.cl/' }] }] }));
      const r = await scrapeKeywordWithStrategy(keyword, serperSettings);
      expect(r && r.position).toBe(2);
      expect(r && r.error).toBe(false);
   });

   it('sin credenciales de respaldo marca error en vez de "fuera"', async () => {
      fetchMock.mockResponseOnce(serperPage);
      const r = await scrapeKeywordWithStrategy(keyword, serperSettings);
      expect(r && r.error).toEqual(expect.stringContaining('google.com/goto'));
   });
});
