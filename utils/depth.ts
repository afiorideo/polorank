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
