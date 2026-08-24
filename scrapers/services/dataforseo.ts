/**
 * PoloRank — DataForSEO scraper (Google organic, live/advanced).
 *
 * - One POST request per keyword; `depth` (10..100) is computed by the app from the scrape strategy
 *   (basic / custom / smart) and arrives as `pagination.num`.
 * - Credentials: Settings → Scraper → API key, in the form `login:password` (DataForSEO API access).
 * - Cost: DataForSEO charges per block of 10 results; the real cost of every response is reported in `cost`
 *   and stored by the app in the `api_usage` table.
 * - Country → `location_code` uses the Google geo-target code already present in utils/countries.ts
 *   (DataForSEO uses the same codes, e.g. Chile = 2152).
 */

// Override only for local integration tests (see docs/plans): DATAFORSEO_ENDPOINT=http://localhost:PORT/...
const DFS_ENDPOINT = process.env.DATAFORSEO_ENDPOINT || 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced';
const MIN_DEPTH = 10;
const MAX_DEPTH = 100;

/** DataForSEO item types → PoloRank normalized SERP feature names. Unknown types are ignored. */
const FEATURE_MAP: { [dfsType: string]: string } = {
   featured_snippet: 'featured_snippet',
   answer_box: 'featured_snippet',
   people_also_ask: 'people_also_ask',
   local_pack: 'local_pack',
   map: 'local_pack',
   video: 'video',
   images: 'images',
   shopping: 'shopping',
   popular_products: 'shopping',
   ai_overview: 'ai_overview',
   knowledge_graph: 'knowledge_graph',
};

type DfsItem = {
   type: string,
   rank_group?: number,
   rank_absolute?: number,
   title?: string,
   url?: string,
};

type DfsResponse = {
   status_code?: number,
   status_message?: string,
   cost?: number,
   tasks?: {
      status_code?: number,
      status_message?: string,
      cost?: number,
      result?: { items?: DfsItem[] }[] | null,
   }[],
};

/** Read the `login:password` pair stored in the scraper API key field. */
export const parseCredentials = (raw: string | undefined): { login: string, password: string } | null => {
   if (!raw || !raw.includes(':')) { return null; }
   const idx = raw.indexOf(':');
   const login = raw.slice(0, idx).trim();
   const password = raw.slice(idx + 1).trim();
   if (!login || !password) { return null; }
   return { login, password };
};

/** Clamp the requested depth to what DataForSEO accepts, in blocks of 10. */
export const normalizeDepth = (num: number | undefined): number => {
   const n = Number.isFinite(num) && num ? Math.ceil(Number(num) / 10) * 10 : MIN_DEPTH;
   return Math.max(MIN_DEPTH, Math.min(MAX_DEPTH, n));
};

/** Map a DataForSEO response to the flat organic list SerpBear expects. Throws on API-level errors so the caller records the message. */
export const extractOrganic = (content: unknown): scraperExtractedItem[] => {
   const res: DfsResponse = typeof content === 'string' ? JSON.parse(content) : content as DfsResponse;
   if (!res || typeof res !== 'object') { throw new Error('DataForSEO: respuesta vacía'); }
   if (res.status_code && res.status_code !== 20000) {
      throw new Error(`DataForSEO ${res.status_code}: ${res.status_message || 'error'}`);
   }
   const task = res.tasks && res.tasks[0];
   if (!task) { throw new Error('DataForSEO: la respuesta no trae tareas'); }
   if (task.status_code && task.status_code !== 20000) {
      throw new Error(`DataForSEO ${task.status_code}: ${task.status_message || 'error en la tarea'}`);
   }
   const items = (task.result && task.result[0] && task.result[0].items) || [];
   const organic = items
      .filter((item) => item.type === 'organic' && item.url && item.title)
      .sort((a, b) => (a.rank_group || 0) - (b.rank_group || 0));
   return organic.map((item, i) => ({ title: item.title as string, url: item.url as string, position: i + 1 }));
};

/** Collect the normalized SERP feature names present in the response (deduplicated, stable order). */
export const extractFeatures = (content: unknown): string[] => {
   const res: DfsResponse = typeof content === 'string' ? JSON.parse(content) : content as DfsResponse;
   const items = (res && res.tasks && res.tasks[0] && res.tasks[0].result && res.tasks[0].result[0]
      && res.tasks[0].result[0].items) || [];
   const found: string[] = [];
   for (const item of items) {
      const mapped = FEATURE_MAP[item.type];
      if (mapped && !found.includes(mapped)) { found.push(mapped); }
   }
   return found;
};

/** Real cost of the request as reported by DataForSEO (top-level `cost`, fallback to the task cost). */
export const extractCost = (content: unknown): number | undefined => {
   const res: DfsResponse = typeof content === 'string' ? JSON.parse(content) : content as DfsResponse;
   if (!res) { return undefined; }
   if (typeof res.cost === 'number') { return res.cost; }
   const task = res.tasks && res.tasks[0];
   return task && typeof task.cost === 'number' ? task.cost : undefined;
};

const dataforseo: ScraperSettings = {
   id: 'dataforseo',
   name: 'DataForSEO',
   website: 'dataforseo.com',
   allowsCity: true,
   depthBased: true,
   method: 'POST',
   // Depth-based scrapers receive the FULL response in serpExtractor (see utils/scraper.ts → scrapeDepthBased)
   resultObjectKey: '',
   headers: (_keyword, settings) => {
      const creds = parseCredentials(settings.scaping_api);
      const token = creds ? Buffer.from(`${creds.login}:${creds.password}`).toString('base64') : '';
      return {
         'Content-Type': 'application/json',
         Authorization: `Basic ${token}`,
      };
   },
   scrapeURL: () => DFS_ENDPOINT,
   body: (keyword, _settings, countries, pagination) => {
      const country = (keyword.country || 'US').toUpperCase();
      const countryInfo = countries[country];
      const languageCode = countryInfo ? countryInfo[2] : 'en';
      const locationCode = countryInfo ? countryInfo[3] : 2840;
      const task: { [k: string]: string | number } = {
         keyword: keyword.keyword,
         language_code: languageCode,
         device: keyword.device === 'mobile' ? 'mobile' : 'desktop',
         os: keyword.device === 'mobile' ? 'android' : 'windows',
         depth: normalizeDepth(pagination?.num),
      };
      if (keyword.city && countryInfo) {
         task.location_name = `${keyword.city},${countryInfo[0]}`;
      } else {
         task.location_code = locationCode;
      }
      return JSON.stringify([task]);
   },
   serpExtractor: (content) => extractOrganic(content),
   featuresExtractor: (response) => extractFeatures(response),
   costExtractor: (response) => extractCost(response),
};

export default dataforseo;
