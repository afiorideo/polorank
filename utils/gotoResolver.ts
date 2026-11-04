/**
 * PoloRank — enlaces google.com/goto (desde fines de agosto 2026).
 *
 * Google ya no entrega el enlace directo de cada resultado: entrega google.com/goto?url=… y la URL real solo se
 * conoce siguiendo la redirección. DataForSEO en modo Live deja ~50% sin resolver y Serper los pasa tal cual.
 * Sin esto, PoloRank no reconoce el dominio cuando su resultado cae en un goto y lo marca "fuera".
 *
 * Se resuelven con el convertidor gratuito de DataForSEO (sirve para goto de cualquier proveedor, probado
 * 2026-10-31). Si algo queda sin resolver y podría estar tapando al dominio, el refresco es un ERROR, no un 0.
 */
import { parseCredentials } from '../scrapers/services/dataforseo';

const ENDPOINT = process.env.DATAFORSEO_GOTO_ENDPOINT || 'https://api.dataforseo.com/v3/appendix/goto_url_converter';
const BATCH = 100;
export const GOTO_TIMEOUT_MS = 90000;

const GOTO_RE = /^https?:\/\/(www\.)?google\.[a-z.]+\/goto\?/i;
export const isGotoUrl = (url?: string): boolean => GOTO_RE.test(url || '');

/** Credenciales `login:password` para el convertidor. */
export const gotoCredentials = (settings: Pick<SettingsType, 'scraper_type' | 'scaping_api' | 'ai_dataforseo_credentials'>): string => {
   if (settings.scraper_type === 'dataforseo' && settings.scaping_api) { return settings.scaping_api; }
   return settings.ai_dataforseo_credentials || process.env.DATAFORSEO_GOTO_CREDENTIALS || '';
};

/** Quita `srsltid` (rastreo de Google Shopping) para que la URL se compare y se muestre limpia. */
const cleanUrl = (url: string): string => {
   try {
      const u = new URL(url);
      u.searchParams.delete('srsltid');
      return u.toString();
   } catch { return url; }
};

const convertBatch = async (gotos: string[], login: string, password: string, timeoutMs: number): Promise<Map<string, string>> => {
   const map = new Map<string, string>();
   const controller = new AbortController();
   const timer = setTimeout(() => controller.abort(), timeoutMs);
   try {
      const res = await fetch(ENDPOINT, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}` },
         body: JSON.stringify([{ goto_urls: gotos }]),
         signal: controller.signal,
      });
      const json: any = await res.json();
      const rows: { goto?: string, url?: string }[] = json?.tasks?.[0]?.result || [];
      for (const row of rows) {
         if (row && row.goto && row.url && !isGotoUrl(row.url)) { map.set(row.goto, cleanUrl(row.url)); }
      }
   } catch (error: any) {
      console.log('[GOTO] Error del convertidor:', error?.message || error);
   } finally {
      clearTimeout(timer);
   }
   return map;
};

/** Reemplaza los goto por la URL real. `unresolved` = puestos que siguen siendo goto. */
export const resolveGotoUrls = async <T extends { url: string, position: number }>(
   results: T[],
   rawCreds: string,
   timeoutMs: number = GOTO_TIMEOUT_MS,
): Promise<{ results: T[], unresolved: number[] }> => {
   const gotos = [...new Set(results.filter((r) => isGotoUrl(r.url)).map((r) => r.url))];
   if (gotos.length === 0) { return { results, unresolved: [] }; }
   const resolved = new Map<string, string>();
   const creds = parseCredentials(rawCreds);
   if (creds) {
      for (let i = 0; i < gotos.length; i += BATCH) {
         // eslint-disable-next-line no-await-in-loop
         const part = await convertBatch(gotos.slice(i, i + BATCH), creds.login, creds.password, timeoutMs);
         part.forEach((v, k) => resolved.set(k, v));
      }
   }
   const out = results.map((r) => (isGotoUrl(r.url) && resolved.has(r.url) ? { ...r, url: resolved.get(r.url) as string } : r));
   return { results: out, unresolved: out.filter((r) => isGotoUrl(r.url)).map((r) => r.position) };
};

/** Motivo para NO confiar en la posición, o null si es confiable. */
export const gotoIncompleteReason = (foundPosition: number, unresolved: number[]): string | null => {
   const blocking = foundPosition > 0 ? unresolved.filter((p) => p < foundPosition) : unresolved;
   if (blocking.length === 0) { return null; }
   return `${blocking.length} enlace(s) google.com/goto sin resolver (puestos ${blocking.join(', ')}) — posición no verificable`;
};
