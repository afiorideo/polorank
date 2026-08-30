/**
 * PoloRank — SEO audit module: the contract every check speaks.
 *
 * Design rules that this file exists to enforce:
 * - A check is a PURE FUNCTION of its input. No fetching, no database: the engine gathers, the check decides.
 *   That is what makes every verdict unit-testable and reproducible.
 * - A check NEVER invents a number. When it cannot measure, it returns `na` — which lowers coverage and is
 *   excluded from compliance, instead of being counted as a failure. A failed fetch is not a zero.
 * - A check is only `manual` when no automatic signal exists at all. The normal case for a judgement call is
 *   `semi`: the measurable half scores and caps at 0.5 until a person confirms it.
 * - `weight` and `severity` are stored as a snapshot on every result row, so redefining a check later never
 *   rewrites the history of past runs.
 */

/** The six donuts. `strategy` scores nothing: it modulates the weights and heads the report. */
export type AuditBlock = 'strategy' | 'indexing' | 'technical' | 'architecture' | 'onpage' | 'content' | 'local';

/** How the verdict is produced. See the rules above. */
export type CheckKind = 'auto' | 'semi' | 'manual';

export type CheckStatus = 'pass' | 'fail' | 'partial' | 'na' | 'pending_review';

/** Business profile: decides the weight of each block. */
export type BusinessProfile = 'local' | 'local_national' | 'ecommerce' | 'services';

export type CheckVerdict = {
   status: CheckStatus,
   /** 0 · 0.5 (ceiling for `semi` until a human confirms) · 1. Ignored when status is 'na'. */
   score: number,
   /** Raw evidence: exactly what was measured, so any verdict can be argued with. */
   evidence: Record<string, unknown>,
   /** Page this verdict refers to. Empty for site-wide checks. */
   url?: string,
};

/** Everything a check may look at. The engine fills it once per run; checks only read. */
export type AuditInput = {
   domain: string,
   profile: BusinessProfile,
   pages: CrawledPage[],
   /** Home page, for convenience — the same object as in `pages`. */
   home?: CrawledPage,
   /** Tracked keywords with what PoloRank already knows: target URL, real ranking URL, volume, SERP blocks. */
   keywords: AuditKeyword[],
};

export type CrawledPage = {
   url: string,
   statusCode: number,
   /** false when the fetch failed or the body was too small to trust. Such a page is never scored as a zero. */
   fetchedOk: boolean,
   title: string,
   h1: string[],
   wordCount: number,
   clickDepth: number,
   indexable: boolean,
   sizeBytes: number,
   /** Internal links found on the page, absolute. */
   internalLinks: string[],
   html?: string,
};

/** What the tracker already knows about a keyword — the part no bought tool can replicate. */
export type AuditKeyword = {
   keyword: string,
   /** The page we WANT to rank. Empty when none was assigned — a finding in itself. */
   targetUrl: string,
   /** The page Google ACTUALLY shows. Empty when the domain does not rank. */
   rankingUrl: string,
   position: number,
   targetPosition: number,
   volume: number,
   serpFeatures: string[],
   /** Top 20 of the SERP as captured that day. */
   serpTop: { position: number, url: string, title: string }[],
};

export type AuditCheck = {
   /** Stable slug, never renamed: it is the key of the historical series. e.g. 'onp.target.title' */
   id: string,
   block: AuditBlock,
   kind: CheckKind,
   /** Shown in the detail table. */
   title: string,
   /** What a failure means and what to do about it. */
   help: string,
   /** 3 critical · 2 important · 1 minor. Snapshotted on every result row. */
   weight: 1 | 2 | 3,
   /** Pure: same input, same verdict. Returns one verdict per page, or a single site-wide one. */
   run: (input: AuditInput) => CheckVerdict[],
};
