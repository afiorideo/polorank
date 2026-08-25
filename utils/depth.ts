/**
 * PoloRank — pure helper (no scraper dependencies) so it can be unit-tested in isolation.
 */
const TOTAL_PAGES = 10;
const PAGE_SIZE = 10;

/**
 * PoloRank: translate the scrape strategy into the number of results to request in ONE call (10..100).
 * - basic  → 10 (first page only)
 * - custom → N pages × 10
 * - smart  → from page 1 up to the page AFTER the last known position (pos 2 → 20, pos 46 → 60);
 *            unknown/new keyword (0) → 10, same as SerpBear's smart strategy.
 * DataForSEO cannot skip pages, so "smart" always starts at result 1.
 */
export const strategyToDepth = (strategy: ScrapeStrategy | '' | undefined, paginationLimit: number, lastPosition: number): number => {
   const maxDepth = TOTAL_PAGES * PAGE_SIZE;
   if (strategy === 'custom') {
      const pages = Math.max(1, Math.min(Math.floor(paginationLimit || 1), TOTAL_PAGES));
      return pages * PAGE_SIZE;
   }
   if (strategy === 'smart') {
      const pos = Number.isFinite(lastPosition) && lastPosition > 0 ? Math.floor(lastPosition) : 0;
      if (pos === 0) { return PAGE_SIZE; }
      const lastPage = Math.ceil(pos / PAGE_SIZE);
      return Math.min(maxDepth, (lastPage + 1) * PAGE_SIZE);
   }
   return PAGE_SIZE;
};

export default strategyToDepth;

/** PoloRank — per-keyword scrape override (stored as JSON in keyword.settings → { scrape: {...} }). */
export type KeywordScrapeSettings = {
   scrape_strategy: ScrapeStrategy,
   scrape_pagination_limit?: number,
   scrape_smart_full_fallback?: boolean,
};

export type ResolvedScrape = {
   strategy: ScrapeStrategy,
   paginationLimit: number,
   smartFullFallback: boolean,
   /** where the effective strategy came from */
   source: 'keyword' | 'domain' | 'global',
};

const VALID: ScrapeStrategy[] = ['basic', 'custom', 'smart'];

/** Parse keyword.settings (raw JSON string or already-parsed object). Returns null when there is no valid override. */
export const parseKeywordScrape = (raw: string | object | null | undefined): KeywordScrapeSettings | null => {
   if (!raw) { return null; }
   let obj: any = raw;
   if (typeof raw === 'string') {
      try { obj = JSON.parse(raw); } catch (e) { return null; }
   }
   const scrape = obj && typeof obj === 'object' ? obj.scrape : null;
   if (!scrape || !VALID.includes(scrape.scrape_strategy)) { return null; }
   const out: KeywordScrapeSettings = { scrape_strategy: scrape.scrape_strategy };
   const limit = parseInt(scrape.scrape_pagination_limit, 10);
   if (Number.isFinite(limit) && limit >= 1 && limit <= TOTAL_PAGES) { out.scrape_pagination_limit = limit; }
   if (typeof scrape.scrape_smart_full_fallback === 'boolean') { out.scrape_smart_full_fallback = scrape.scrape_smart_full_fallback; }
   return out;
};

/** Serialize a keyword override back into the keyword.settings JSON (merging any other keys already there). */
export const serializeKeywordScrape = (existingRaw: string | null | undefined, scrape: KeywordScrapeSettings | null): string => {
   let obj: any = {};
   if (existingRaw) { try { obj = JSON.parse(existingRaw) || {}; } catch (e) { obj = {}; } }
   if (scrape) { obj.scrape = scrape; } else { delete obj.scrape; }
   return JSON.stringify(obj);
};

/**
 * Effective scrape strategy: keyword override → domain override → global settings.
 * Unset fields fall back to the next level (same behaviour SerpBear had for domain → global).
 */
export const resolveScrapeStrategy = (
   settings: Pick<SettingsType, 'scrape_strategy' | 'scrape_pagination_limit' | 'scrape_smart_full_fallback'>,
   domainSettings?: Partial<DomainType> | null,
   keywordScrape?: KeywordScrapeSettings | null,
): ResolvedScrape => {
   const global: ResolvedScrape = {
      strategy: (settings.scrape_strategy || 'basic') as ScrapeStrategy,
      paginationLimit: settings.scrape_pagination_limit || 5,
      smartFullFallback: settings.scrape_smart_full_fallback || false,
      source: 'global',
   };
   const domain: ResolvedScrape = domainSettings?.scrape_strategy ? {
      strategy: domainSettings.scrape_strategy as ScrapeStrategy,
      paginationLimit: domainSettings.scrape_pagination_limit || global.paginationLimit,
      smartFullFallback: domainSettings.scrape_smart_full_fallback || global.smartFullFallback,
      source: 'domain',
   } : global;
   if (!keywordScrape) { return domain; }
   return {
      strategy: keywordScrape.scrape_strategy,
      paginationLimit: keywordScrape.scrape_pagination_limit || domain.paginationLimit,
      smartFullFallback: keywordScrape.scrape_smart_full_fallback !== undefined ? keywordScrape.scrape_smart_full_fallback : domain.smartFullFallback,
      source: 'keyword',
   };
};

/** Short human label, e.g. "1 página", "5 páginas", "smart", "smart + fallback". */
export const describeScrape = (r: Pick<ResolvedScrape, 'strategy' | 'paginationLimit' | 'smartFullFallback'>): string => {
   if (r.strategy === 'smart') { return r.smartFullFallback ? 'smart + fallback' : 'smart'; }
   if (r.strategy === 'custom') { return r.paginationLimit === 1 ? '1 página' : `${r.paginationLimit} páginas`; }
   return '1 página';
};
