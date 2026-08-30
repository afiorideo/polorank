/**
 * PoloRank — the audit crawler. It visits a client's site, so it is built to be a polite, bounded guest and to
 * be incapable of harming the position tracking, which is the critical job of this server.
 *
 * Every limit here exists for a reason:
 * - TIMEOUT + SIZE CAP: a page that never answers, or answers 300 MB, must not hold a worker or eat the VPS.
 * - CONCURRENCY 2 + COURTESY DELAY: these are clients' sites, most on shared WordPress hosting. Two parallel
 *   requests with a pause between them is what a human browsing fast looks like.
 * - PAGE CAP + TOTAL CUTOFF: mavae.cl has 1.591 URLs. Without a ceiling one site could run for hours.
 * - FULL BROWSER HEADERS: maderasfresard.com sits behind mod_security, which answers `Not Acceptable!` to a
 *   request without `Accept` / `Accept-Language`. A naive crawler reads that as an empty page and reports 0%
 *   on a healthy site.
 * - THE NOT-MEASURABLE RULE: a failed fetch, a non-200, or a body too small to be a real page is reported as
 *   `fetchedOk: false`. It is never scored as a zero — it lowers coverage instead. A network problem is not an
 *   SEO problem.
 */
import { parsePage } from './parse';
import type { CrawledPage } from './types';

export type CrawlLimits = {
   timeoutMs: number,
   maxBytes: number,
   concurrency: number,
   courtesyMs: number,
   maxPages: number,
   maxDurationMs: number,
   /** Below this, the body cannot be a real page: an error page, a redirect stub, an empty shell. */
   minBytes: number,
};

export const DEFAULT_LIMITS: CrawlLimits = {
   timeoutMs: 10000,
   maxBytes: 2 * 1024 * 1024,
   concurrency: 2,
   courtesyMs: 500,
   maxPages: 300,
   maxDurationMs: 10 * 60 * 1000,
   minBytes: 2048,
};

/** A real browser's headers. Without Accept/Accept-Language a WAF may refuse the request outright. */
export const CRAWLER_HEADERS: Record<string, string> = {
   'User-Agent': 'Mozilla/5.0 (compatible; PoloRankAudit/1.0; +https://polorank.emignia.com)',
   Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
   'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
   'Accept-Encoding': 'gzip, deflate, br',
   'Cache-Control': 'no-cache',
};

/**
 * URLs that are not pages and must never be audited. Without this the crawler follows WordPress upload links
 * and reports "broken canonical" and "title too short" on image files — noise that buries the real findings.
 */
const SKIP_EXTENSIONS = new RegExp(
   '\\.(jpe?g|png|gif|webp|avif|svg|ico|bmp|tiff?|mp4|webm|mov|avi|mp3|wav|ogg|pdf'
   + '|docx?|xlsx?|pptx?|zip|rar|gz|tar|css|js|json|xml|txt|woff2?|ttf|eot)(\\?|$)',
   'i',
);
const SKIP_PATHS = [
   '/wp-content/', '/wp-admin/', '/wp-json/', '/wp-includes/', '/feed/', '/xmlrpc.php',
   '/cart/', '/checkout/', '/mi-cuenta/', '/my-account/', '/carrito/',
];
const SKIP_QUERY = ['add-to-cart=', 'replytocom=', 'orderby=', 'paged=', 's='];

/** Should this URL be fetched at all? */
export const isAuditable = (url: string): boolean => {
   let u: URL;
   try { u = new URL(url); } catch { return false; }
   const path = u.pathname.toLowerCase();
   if (SKIP_EXTENSIONS.test(path)) { return false; }
   if (SKIP_PATHS.some((p) => path.includes(p))) { return false; }
   if (SKIP_QUERY.some((q) => u.search.includes(q))) { return false; }
   return true;
};

export type FetchResult = {
   url: string,
   statusCode: number,
   /** true only when we got a 200 with a body big enough to be a real page. */
   ok: boolean,
   html: string,
   sizeBytes: number,
   error: string,
};

export type FetchFn = (url: string, init: { signal: AbortSignal, headers: Record<string, string> }) => Promise<Response>;

const sleep = (ms: number): Promise<void> => new Promise((r) => { setTimeout(r, ms); });

/** Read a response body, stopping at `maxBytes` so a huge page cannot exhaust memory. */
const readCapped = async (res: Response, maxBytes: number): Promise<string> => {
   const body = res.body as unknown as { getReader?: () => ReadableStreamDefaultReader<Uint8Array> } | null;
   if (!body || typeof body.getReader !== 'function') { return (await res.text()).slice(0, maxBytes); }
   const reader = body.getReader();
   const decoder = new TextDecoder();
   let out = '';
   let read = 0;
   for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) { break; }
      read += value.byteLength;
      out += decoder.decode(value, { stream: true });
      if (read >= maxBytes) { await reader.cancel(); break; }
   }
   return out;
};

/** Fetch one page under the limits. Never throws: a failure is reported, not raised. */
export const fetchPage = async (
   url: string,
   limits: CrawlLimits = DEFAULT_LIMITS,
   doFetch: FetchFn = (u, init) => fetch(u, init),
): Promise<FetchResult> => {
   const controller = new AbortController();
   const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
   try {
      const res = await doFetch(url, { signal: controller.signal, headers: CRAWLER_HEADERS });
      const html = await readCapped(res, limits.maxBytes);
      const sizeBytes = html.length;
      const tooSmall = sizeBytes < limits.minBytes;
      // the URL filter can be fooled (an extensionless file, a redirect); the content type cannot
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const isHtml = contentType === '' || contentType.includes('text/html') || contentType.includes('application/xhtml');
      let error = '';
      if (res.status !== 200) {
         error = `HTTP ${res.status}`;
      } else if (!isHtml) {
         error = `No es HTML (${contentType})`;
      } else if (tooSmall) {
         error = `Respuesta demasiado corta (${sizeBytes} bytes)`;
      }
      const ok = res.status === 200 && isHtml && !tooSmall;
      return { url, statusCode: res.status, ok, html, sizeBytes, error };
   } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { url, statusCode: 0, ok: false, html: '', sizeBytes: 0, error: msg === 'The operation was aborted.' ? 'Tiempo agotado' : msg };
   } finally {
      clearTimeout(timer);
   }
};

/** Turn a fetch result plus its parse into the shape the checks read. */
export const toCrawledPage = (res: FetchResult, clickDepth: number): CrawledPage => {
   if (!res.ok) {
      return {
         url: res.url,
         statusCode: res.statusCode,
         fetchedOk: false,
         title: '',
         h1: [],
         wordCount: 0,
         clickDepth,
         indexable: true,
         sizeBytes: res.sizeBytes,
         internalLinks: [],
      };
   }
   const p = parsePage(res.html, res.url);
   return {
      url: res.url,
      statusCode: res.statusCode,
      fetchedOk: true,
      title: p.title,
      h1: p.h1,
      wordCount: p.wordCount,
      clickDepth,
      indexable: p.indexable,
      sizeBytes: res.sizeBytes,
      internalLinks: p.internalLinks,
      parsed: p,
   };
};

export type CrawlOptions = {
   /** Visited first, in this order: the home and every keyword target URL. */
   seeds: string[],
   limits?: Partial<CrawlLimits>,
   doFetch?: FetchFn,
   /** Called as each page finishes, so the caller can persist without holding everything in memory. */
   onPage?: (page: CrawledPage) => void | Promise<void>,
   now?: () => number,
};

export type CrawlResult = { pages: CrawledPage[], stoppedBy: '' | 'maxPages' | 'timeout' };

const stripHash = (u: string): string => u.split('#')[0].replace(/\/+$/, '') || u;

/**
 * Breadth-first crawl from the seeds, following internal links. Seeds always come first, so the pages that
 * matter (home and the keyword targets) are covered even when the cap cuts the run short.
 */
export const crawlSite = async (options: CrawlOptions): Promise<CrawlResult> => {
   const limits: CrawlLimits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
   const doFetch = options.doFetch || ((u, init) => fetch(u, init));
   const now = options.now || (() => Date.now());
   const startedAt = now();

   const seen = new Set<string>();
   const queue: { url: string, depth: number }[] = [];
   options.seeds.filter(Boolean).forEach((u) => {
      const key = stripHash(u);
      if (!seen.has(key)) { seen.add(key); queue.push({ url: u, depth: 0 }); }
   });

   const pages: CrawledPage[] = [];
   let stoppedBy: CrawlResult['stoppedBy'] = '';

   while (queue.length > 0) {
      if (pages.length >= limits.maxPages) { stoppedBy = 'maxPages'; break; }
      if (now() - startedAt >= limits.maxDurationMs) { stoppedBy = 'timeout'; break; }

      const batch = queue.splice(0, Math.min(limits.concurrency, limits.maxPages - pages.length));
      // eslint-disable-next-line no-await-in-loop
      const results = await Promise.all(batch.map(async (item) => {
         const res = await fetchPage(item.url, limits, doFetch);
         return toCrawledPage(res, item.depth);
      }));

      for (const page of results) {
         pages.push(page);
         // eslint-disable-next-line no-await-in-loop
         if (options.onPage) { await options.onPage(page); }
         const depth = page.clickDepth + 1;
         page.internalLinks.filter(isAuditable).forEach((link) => {
            const key = stripHash(link);
            if (!seen.has(key) && seen.size < limits.maxPages * 3) { seen.add(key); queue.push({ url: link, depth }); }
         });
      }

      if (queue.length > 0 && limits.courtesyMs > 0) {
         // eslint-disable-next-line no-await-in-loop
         await sleep(limits.courtesyMs);
      }
   }

   return { pages, stoppedBy };
};

export default crawlSite;
