/**
 * PoloRank — per-page checks that need nothing beyond the crawl itself.
 *
 * The rule that shapes every one of them: a page we could not read (`fetchedOk: false`) returns `na`, never a
 * failure. A WAF, a timeout or a 500 is a problem with the measurement, not with the SEO — and a red donut
 * built on a failed fetch is worse than no donut at all.
 */
import type { AuditCheck, AuditInput, CheckVerdict, CrawledPage } from '../types';

/** Google truncates titles past roughly this width; too short usually means the page is not saying what it is. */
export const TITLE_MIN = 15;
export const TITLE_MAX = 65;
export const DESC_MIN = 70;
export const DESC_MAX = 165;
/** Below this, a page has no substance to rank with. */
export const CONTENT_MIN_WORDS = 300;
/** A page heavier than this is a performance problem before it is anything else. */
export const PAGE_MAX_BYTES = 3 * 1024 * 1024;

const unreadable = (page: CrawledPage, motivo: string): CheckVerdict => ({
   status: 'na',
   score: 0,
   url: page.url,
   evidence: { motivo, http: page.statusCode },
});

/** Build a per-page check, handling the unreadable case once so no check can forget it. */
const perPage = (
   def: Omit<AuditCheck, 'run'>,
   decide: (page: CrawledPage, input: AuditInput) => CheckVerdict,
): AuditCheck => ({
   ...def,
   run: (input: AuditInput): CheckVerdict[] => input.pages.map((page) => (
      page.fetchedOk ? decide(page, input) : unreadable(page, 'No se pudo leer la página')
   )),
});

const verdict = (page: CrawledPage, pass: boolean, evidence: Record<string, unknown>): CheckVerdict => ({
   status: pass ? 'pass' : 'fail',
   score: pass ? 1 : 0,
   url: page.url,
   evidence,
});

export const httpsCheck = perPage(
   {
      id: 'idx.https',
      block: 'indexing',
      kind: 'auto',
      title: 'La página se sirve por HTTPS',
      help: 'Sin HTTPS Google desconfía del sitio y los navegadores lo marcan como no seguro.',
      weight: 3,
   },
   (page) => verdict(page, page.url.startsWith('https://'), { url: page.url }),
);

export const indexableCheck = perPage(
   {
      id: 'idx.indexable',
      block: 'indexing',
      kind: 'auto',
      title: 'La página es indexable',
      help: 'Una página con noindex no puede aparecer en Google, por impecable que esté todo lo demás.',
      weight: 3,
   },
   (page) => verdict(page, page.indexable, { indexable: page.indexable }),
);

export const statusCheck = perPage(
   {
      id: 'idx.status',
      block: 'indexing',
      kind: 'auto',
      title: 'La página responde 200',
      help: 'Un 404 o un 500 en una página importante corta el rastreo y pierde el posicionamiento acumulado.',
      weight: 3,
   },
   (page) => verdict(page, page.statusCode === 200, { http: page.statusCode }),
);

export const titleCheck = perPage(
   {
      id: 'onp.title',
      block: 'onpage',
      kind: 'auto',
      title: 'Title presente y de largo razonable',
      help: `Entre ${TITLE_MIN} y ${TITLE_MAX} caracteres: más largo lo corta Google, más corto no alcanza a decir de qué trata.`,
      weight: 2,
   },
   (page) => {
      const len = page.title.trim().length;
      return verdict(page, len >= TITLE_MIN && len <= TITLE_MAX, { title: page.title, largo: len, minimo: TITLE_MIN, maximo: TITLE_MAX });
   },
);

export const h1Check = perPage(
   {
      id: 'onp.h1.unique',
      block: 'onpage',
      kind: 'auto',
      title: 'Un solo H1, con contenido',
      help: 'El H1 le dice a Google cuál es el tema de la página. Ninguno o varios diluyen esa señal.',
      weight: 2,
   },
   (page) => verdict(page, page.h1.length === 1, { h1: page.h1, cantidad: page.h1.length }),
);

export const contentDepthCheck = perPage(
   {
      id: 'cnt.depth',
      block: 'content',
      kind: 'auto',
      title: 'Contenido principal suficiente',
      help: `Al menos ${CONTENT_MIN_WORDS} palabras de contenido propio, sin contar menú ni pie de página.`,
      weight: 2,
   },
   (page) => verdict(page, page.wordCount >= CONTENT_MIN_WORDS, { palabras: page.wordCount, minimo: CONTENT_MIN_WORDS }),
);

export const internalLinksCheck = perPage(
   {
      id: 'arq.links.out',
      block: 'architecture',
      kind: 'auto',
      title: 'La página enlaza a otras del sitio',
      help: 'Una página sin enlaces internos es un callejón sin salida: no reparte autoridad ni guía al usuario.',
      weight: 1,
   },
   (page) => verdict(page, page.internalLinks.length > 0, { enlacesInternos: page.internalLinks.length }),
);

export const depthCheck = perPage(
   {
      id: 'arq.depth',
      block: 'architecture',
      kind: 'auto',
      title: 'A tres clics o menos de la home',
      help: 'Lo que está más profundo se rastrea menos y recibe menos autoridad interna.',
      weight: 2,
   },
   (page) => verdict(page, page.clickDepth <= 3, { clics: page.clickDepth }),
);

export const weightCheck = perPage(
   {
      id: 'tec.size',
      block: 'technical',
      kind: 'auto',
      title: 'Peso de la página razonable',
      help: 'Una página muy pesada tarda en cargar, y la velocidad afecta tanto al ranking como a la conversión.',
      weight: 1,
   },
   (page) => verdict(page, page.sizeBytes <= PAGE_MAX_BYTES, { bytes: page.sizeBytes, maximo: PAGE_MAX_BYTES }),
);

/** Checks that read the fuller parse. A page without it was not readable, so they return `na` too. */
const perParsed = (
   def: Omit<AuditCheck, 'run'>,
   decide: (page: CrawledPage, parsed: NonNullable<CrawledPage['parsed']>) => CheckVerdict,
): AuditCheck => ({
   ...def,
   run: (input: AuditInput): CheckVerdict[] => input.pages.map((page) => (
      page.fetchedOk && page.parsed ? decide(page, page.parsed) : unreadable(page, 'No se pudo leer la página')
   )),
});

export const metaDescriptionCheck = perParsed(
   {
      id: 'onp.meta.description',
      block: 'onpage',
      kind: 'auto',
      title: 'Meta description presente y de largo razonable',
      help: `Entre ${DESC_MIN} y ${DESC_MAX} caracteres. No afecta al ranking pero decide cuánta gente hace clic.`,
      weight: 1,
   },
   (page, parsed) => {
      const len = parsed.metaDescription.trim().length;
      return verdict(page, len >= DESC_MIN && len <= DESC_MAX, { largo: len, minimo: DESC_MIN, maximo: DESC_MAX, texto: parsed.metaDescription });
   },
);

export const canonicalCheck = perParsed(
   {
      id: 'idx.canonical',
      block: 'indexing',
      kind: 'auto',
      title: 'Canonical presente y apuntando a sí misma',
      help: 'Un canonical hacia otra URL le dice a Google que no indexe esta página. Es un error caro y silencioso.',
      weight: 2,
   },
   (page, parsed) => {
      const norm = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
      const propio = !!parsed.canonical && norm(parsed.canonical) === norm(page.url);
      return verdict(page, propio, { canonical: parsed.canonical || '(ninguno)', url: page.url });
   },
);

export const imgAltCheck = perParsed(
   {
      id: 'onp.img.alt',
      block: 'onpage',
      kind: 'auto',
      title: 'Todas las imágenes tienen alt',
      help: 'El alt describe la imagen para Google y para quien usa lector de pantalla.',
      weight: 1,
   },
   (page, parsed) => {
      if (parsed.images === 0) {
         return { status: 'na', score: 0, url: page.url, evidence: { motivo: 'La página no tiene imágenes' } };
      }
      return verdict(page, parsed.imagesWithoutAlt === 0, { imagenes: parsed.images, sinAlt: parsed.imagesWithoutAlt });
   },
);

export const langCheck = perParsed(
   {
      id: 'tec.lang',
      block: 'technical',
      kind: 'auto',
      title: 'El idioma está declarado en el HTML',
      help: 'Sin atributo lang, Google y los lectores de pantalla tienen que adivinar el idioma de la página.',
      weight: 1,
   },
   (page, parsed) => verdict(page, !!parsed.lang, { lang: parsed.lang || '(sin declarar)' }),
);

export const contactCheck = perParsed(
   {
      id: 'onp.contact',
      block: 'onpage',
      kind: 'auto',
      title: 'Hay una forma de contacto accesible',
      help: 'Un teléfono, un WhatsApp o un formulario. Sin ninguno, el tráfico que llega no tiene cómo convertirse.',
      weight: 2,
   },
   (page, parsed) => {
      const vias = parsed.telLinks + parsed.whatsappLinks + (parsed.hasForm ? 1 : 0);
      return verdict(page, vias > 0, { telefono: parsed.telLinks, whatsapp: parsed.whatsappLinks, formulario: parsed.hasForm });
   },
);

export default [
   httpsCheck, indexableCheck, statusCheck, canonicalCheck,
   titleCheck, h1Check, metaDescriptionCheck, imgAltCheck, contactCheck, contentDepthCheck,
   internalLinksCheck, depthCheck, weightCheck, langCheck,
];
