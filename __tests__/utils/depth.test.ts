import { describeScrape, parseKeywordScrape, resolveScrapeStrategy, serializeKeywordScrape } from '../../utils/depth';

const global = { scrape_strategy: 'basic' as const, scrape_pagination_limit: 5, scrape_smart_full_fallback: false };
const mavae = { scrape_strategy: 'custom' as const, scrape_pagination_limit: 5, scrape_smart_full_fallback: true };

describe('profundidad por keyword (PoloRank)', () => {
   it('parseKeywordScrape acepta solo overrides válidos', () => {
      expect(parseKeywordScrape(null)).toBeNull();
      expect(parseKeywordScrape('')).toBeNull();
      expect(parseKeywordScrape('{}')).toBeNull();
      expect(parseKeywordScrape('no json')).toBeNull();
      expect(parseKeywordScrape('{"scrape":{"scrape_strategy":"loco"}}')).toBeNull();
      expect(parseKeywordScrape('{"scrape":{"scrape_strategy":"custom","scrape_pagination_limit":"3"}}'))
         .toEqual({ scrape_strategy: 'custom', scrape_pagination_limit: 3 });
      expect(parseKeywordScrape({ scrape: { scrape_strategy: 'smart', scrape_smart_full_fallback: true } }))
         .toEqual({ scrape_strategy: 'smart', scrape_smart_full_fallback: true });
      expect(parseKeywordScrape('{"scrape":{"scrape_strategy":"custom","scrape_pagination_limit":50}}')).toEqual({ scrape_strategy: 'custom' });
   });

   it('serializeKeywordScrape conserva otras claves y permite limpiar', () => {
      const raw = serializeKeywordScrape('{"otra":1}', { scrape_strategy: 'basic' });
      expect(JSON.parse(raw)).toEqual({ otra: 1, scrape: { scrape_strategy: 'basic' } });
      expect(JSON.parse(serializeKeywordScrape(raw, null))).toEqual({ otra: 1 });
      expect(JSON.parse(serializeKeywordScrape('basura', { scrape_strategy: 'smart' }))).toEqual({ scrape: { scrape_strategy: 'smart' } });
   });

   it('resolución: keyword → dominio → global', () => {
      expect(resolveScrapeStrategy(global)).toMatchObject({ strategy: 'basic', paginationLimit: 5, source: 'global' });
      expect(resolveScrapeStrategy(global, mavae))
         .toMatchObject({ strategy: 'custom', paginationLimit: 5, smartFullFallback: true, source: 'domain' });
      expect(resolveScrapeStrategy(global, mavae, { scrape_strategy: 'basic' })).toMatchObject({ strategy: 'basic', source: 'keyword' });
      expect(resolveScrapeStrategy(global, mavae, { scrape_strategy: 'custom', scrape_pagination_limit: 2 }))
         .toMatchObject({ strategy: 'custom', paginationLimit: 2, source: 'keyword' });
      // campos no definidos en la keyword caen al dominio
      expect(resolveScrapeStrategy(global, mavae, { scrape_strategy: 'smart' }))
         .toMatchObject({ strategy: 'smart', smartFullFallback: true, source: 'keyword' });
      expect(resolveScrapeStrategy(global, mavae, { scrape_strategy: 'smart', scrape_smart_full_fallback: false }))
         .toMatchObject({ smartFullFallback: false });
      expect(resolveScrapeStrategy(global, { scrape_strategy: '' }, null)).toMatchObject({ source: 'global' });
   });

   it('describeScrape da etiquetas cortas', () => {
      expect(describeScrape({ strategy: 'basic', paginationLimit: 5, smartFullFallback: false })).toBe('1 página');
      expect(describeScrape({ strategy: 'custom', paginationLimit: 5, smartFullFallback: false })).toBe('5 páginas');
      expect(describeScrape({ strategy: 'custom', paginationLimit: 1, smartFullFallback: false })).toBe('1 página');
      expect(describeScrape({ strategy: 'smart', paginationLimit: 5, smartFullFallback: true })).toBe('smart + fallback');
   });
});
