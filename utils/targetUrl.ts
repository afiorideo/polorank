/**
 * PoloRank — "URL objetivo" por keyword (pure helpers, unit-tested, no DB).
 *
 * The domain position (SerpBear) answers "where does the site appear?". The target URL answers
 * "where does *this* landing appear?" using the same SERP. Optional per keyword: without it the
 * keyword behaves exactly as before.
 */

/** host + path in canonical form: no protocol, no www., no trailing slash, no query/hash, lower case. */
export const normalizeUrl = (raw: string | null | undefined): string => {
   if (!raw || typeof raw !== 'string') { return ''; }
   let s = raw.trim().toLowerCase();
   s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
   [s] = s.split('#');
   [s] = s.split('?');
   s = s.replace(/\/+$/, '');
   return s;
};

/** Two URLs point to the same page (ignoring protocol, www, trailing slash, query and hash). */
export const sameUrl = (a: string | null | undefined, b: string | null | undefined): boolean => {
   const na = normalizeUrl(a);
   const nb = normalizeUrl(b);
   return na !== '' && na === nb;
};

/**
 * Accepts a full URL or a path ("/landing/") and returns the canonical full URL on the keyword's domain,
 * or null when the input is empty or points to another site.
 */
export const toTargetUrl = (input: string | null | undefined, domain: string): string | null => {
   if (!input || typeof input !== 'string' || !domain) { return null; }
   const trimmed = input.trim();
   if (!trimmed) { return null; }
   const host = normalizeUrl(domain);
   if (trimmed.startsWith('/')) { return `https://${host}${trimmed}`; }
   const norm = normalizeUrl(trimmed);
   if (norm === host || norm.startsWith(`${host}/`)) { return `https://${norm}`; }
   // allow subdomains of the tracked domain (blog.site.com)
   const hostPart = norm.split('/')[0];
   if (hostPart.endsWith(`.${host}`)) { return `https://${norm}`; }
   return null;
};

/** Short display form: the path on the domain ("/" for the home). */
export const targetPath = (targetUrl: string | null | undefined, domain: string): string => {
   const norm = normalizeUrl(targetUrl);
   if (!norm) { return ''; }
   const host = normalizeUrl(domain);
   const rest = norm.startsWith(host) ? norm.slice(host.length) : norm;
   return rest || '/';
};

type ResultLike = { url: string, position: number, skipped?: boolean };

/** Position (1-based) of the first SERP result that is the target page; 0 when absent. */
export const findTargetPosition = (targetUrl: string | null | undefined, results: ResultLike[] | null | undefined): number => {
   if (!targetUrl || !Array.isArray(results)) { return 0; }
   const found = results.find((r) => r && !r.skipped && !!r.url && sameUrl(r.url, targetUrl));
   return found ? found.position : 0;
};

/** True when the keyword has a target and the domain ranks with a *different* page. */
export const ranksOtherPage = (targetUrl: string | null | undefined, rankingUrl: string | null | undefined, position: number): boolean => {
   if (!targetUrl || !rankingUrl || position <= 0) { return false; }
   return !sameUrl(targetUrl, rankingUrl);
};
