/**
 * PoloRank — turning a page's HTML into the facts the checks read. Pure: no network, no database.
 *
 * Three lessons are baked in here, each of them a way an audit lies:
 * - `@type` in JSON-LD can be a string OR an array, and the useful entries often hide inside `@graph`.
 *   Looking for the literal text `"@type":"LocalBusiness"` answers NO on a site that does declare it.
 * - Header and footer text inflates the word count and pollutes the heading hierarchy (a copyright line
 *   sitting in an H2). Main content is measured separately from the whole document.
 * - A page that could not be read is not a page that scored zero. That verdict is made in the crawler; this
 *   parser simply reports what it found.
 */
import * as cheerio from 'cheerio';

export type ParsedPage = {
   title: string,
   metaDescription: string,
   h1: string[],
   h2: string[],
   canonical: string,
   /** false when meta robots says noindex. */
   indexable: boolean,
   robotsMeta: string,
   /** Words of the main content, header and footer excluded. */
   wordCount: number,
   /** Words of the whole visible document, for comparison. */
   wordCountAll: number,
   images: number,
   imagesWithoutAlt: number,
   /** Absolute internal links (same host). */
   internalLinks: string[],
   externalLinks: number,
   /** Schema.org types declared, flattened from @graph and from `@type` arrays. */
   schemaTypes: string[],
   /** Contact affordances: a business page with none of these is hard to convert. */
   telLinks: number,
   whatsappLinks: number,
   hasForm: boolean,
   lang: string,
};

const WORD = /\S+/g;
const countWords = (text: string): number => (text.match(WORD) || []).length;

/** Every `@type` in a JSON-LD blob, walking `@graph` and treating `@type` as string or array. */
export const schemaTypesOf = (json: unknown): string[] => {
   const out: string[] = [];
   const walk = (node: unknown): void => {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (!node || typeof node !== 'object') { return; }
      const obj = node as Record<string, unknown>;
      const type = obj['@type'];
      if (typeof type === 'string') { out.push(type); }
      if (Array.isArray(type)) { type.forEach((x) => { if (typeof x === 'string') { out.push(x); } }); }
      if (obj['@graph']) { walk(obj['@graph']); }
   };
   walk(json);
   return [...new Set(out)];
};

/** Resolve a href against the page URL, dropping fragments and anything that is not http(s). */
const absolute = (href: string, base: string): string | null => {
   try {
      const u = new URL(href, base);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') { return null; }
      u.hash = '';
      return u.toString();
   } catch { return null; }
};

export const parsePage = (html: string, pageUrl: string): ParsedPage => {
   const $ = cheerio.load(html);
   const host = (() => { try { return new URL(pageUrl).host.replace(/^www\./, ''); } catch { return ''; } })();

   $('script, style, noscript, template, svg').remove();

   const robotsMeta = ($('meta[name="robots"]').attr('content') || '').toLowerCase();
   const wholeText = $('body').text();

   // main content = body minus the chrome, so the word count reflects the page and not the menu
   const $body = $('body').clone();
   $body.find('header, footer, nav, aside').remove();
   const $main = $('main').length ? $('main') : $body;

   const internal: string[] = [];
   let external = 0;
   $('a[href]').each((_, el) => {
      const abs = absolute($(el).attr('href') || '', pageUrl);
      if (!abs) { return; }
      const linkHost = (() => { try { return new URL(abs).host.replace(/^www\./, ''); } catch { return ''; } })();
      if (host && linkHost === host) { internal.push(abs); } else { external += 1; }
   });

   // JSON-LD lives in <script>, which was stripped above, so it is read from a second, untouched parse
   const schemaTypes: string[] = [];
   const $raw = cheerio.load(html);
   $raw('script[type="application/ld+json"]').each((_, el) => {
      const raw = $raw(el).text().trim();
      if (!raw) { return; }
      try { schemaTypes.push(...schemaTypesOf(JSON.parse(raw))); } catch { /* JSON-LD roto: no cuenta como tipo declarado */ }
   });

   const hrefs = $('a[href]').map((_, el) => ($(el).attr('href') || '').toLowerCase()).get();

   return {
      title: ($('title').first().text() || '').trim(),
      metaDescription: ($('meta[name="description"]').attr('content') || '').trim(),
      h1: $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean),
      h2: $('h2').map((_, el) => $(el).text().trim()).get().filter(Boolean),
      canonical: ($('link[rel="canonical"]').attr('href') || '').trim(),
      indexable: !robotsMeta.includes('noindex'),
      robotsMeta,
      wordCount: countWords($main.text()),
      wordCountAll: countWords(wholeText),
      images: $('img').length,
      imagesWithoutAlt: $('img').filter((_, el) => !($(el).attr('alt') || '').trim()).length,
      internalLinks: [...new Set(internal)],
      externalLinks: external,
      schemaTypes: [...new Set(schemaTypes)],
      telLinks: hrefs.filter((h) => h.startsWith('tel:')).length,
      whatsappLinks: hrefs.filter((h) => h.includes('wa.me') || h.includes('api.whatsapp.com')).length,
      hasForm: $('form').length > 0,
      lang: ($('html').attr('lang') || '').trim(),
   };
};

export default parsePage;
