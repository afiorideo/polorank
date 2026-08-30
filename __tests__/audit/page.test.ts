import checks, {
   httpsCheck, indexableCheck, titleCheck, h1Check, contentDepthCheck,
   canonicalCheck, imgAltCheck, contactCheck, metaDescriptionCheck,
   CONTENT_MIN_WORDS, TITLE_MAX,
} from '../../utils/audit/checks/page';
import type { AuditInput, CrawledPage } from '../../utils/audit/types';
import type { ParsedPage } from '../../utils/audit/parse';

const parsed = (over: Partial<ParsedPage> = {}): ParsedPage => ({
   title: '',
metaDescription: '',
h1: [],
h2: [],
canonical: '',
indexable: true,
robotsMeta: '',
   wordCount: 0,
wordCountAll: 0,
images: 0,
imagesWithoutAlt: 0,
internalLinks: [],
externalLinks: 0,
   schemaTypes: [],
telLinks: 0,
whatsappLinks: 0,
hasForm: false,
lang: 'es',
...over,
});

const page = (over: Partial<CrawledPage> = {}): CrawledPage => ({
   url: 'https://x.cl/',
statusCode: 200,
fetchedOk: true,
title: 'Un title suficientemente largo',
   h1: ['Un H1'],
wordCount: 500,
clickDepth: 0,
indexable: true,
sizeBytes: 50000,
internalLinks: ['https://x.cl/a'],
   parsed: parsed(),
...over,
});

const input = (pages: CrawledPage[]): AuditInput => ({ domain: 'x.cl', profile: 'services', pages, keywords: [] });

describe('auditoría · checks por página', () => {
   it('REGLA CENTRAL: una página que no se pudo leer nunca puntúa cero, devuelve "na"', () => {
      const rota = page({ fetchedOk: false, statusCode: 406, title: '', h1: [], wordCount: 0, parsed: undefined });
      checks.forEach((check) => {
         const out = check.run(input([rota]));
         expect(out[0].status).toBe('na');
         expect(out[0].evidence).toMatchObject({ http: 406 });
      });
   });

   it('detecta HTTP en vez de HTTPS', () => {
      expect(httpsCheck.run(input([page({ url: 'http://x.cl/' })]))[0].status).toBe('fail');
      expect(httpsCheck.run(input([page()]))[0].status).toBe('pass');
   });

   it('detecta noindex — el portón que tapa todo lo demás', () => {
      expect(indexableCheck.run(input([page({ indexable: false })]))[0].status).toBe('fail');
   });

   it('mide el largo del title y lo dice en la evidencia', () => {
      const largo = 'x'.repeat(TITLE_MAX + 10);
      const out = titleCheck.run(input([page({ title: largo })]));
      expect(out[0].status).toBe('fail');
      expect(out[0].evidence).toMatchObject({ largo: TITLE_MAX + 10, maximo: TITLE_MAX });
      expect(titleCheck.run(input([page({ title: 'corto' })]))[0].status).toBe('fail');
   });

   it('exige exactamente un H1', () => {
      expect(h1Check.run(input([page({ h1: [] })]))[0].status).toBe('fail');
      expect(h1Check.run(input([page({ h1: ['a', 'b'] })]))[0].status).toBe('fail');
      expect(h1Check.run(input([page({ h1: ['a'] })]))[0].status).toBe('pass');
   });

   it('caso real de Fresard: 194 palabras no alcanzan para competir', () => {
      const out = contentDepthCheck.run(input([page({ wordCount: 194 })]));
      expect(out[0].status).toBe('fail');
      expect(out[0].evidence).toMatchObject({ palabras: 194, minimo: CONTENT_MIN_WORDS });
   });

   it('detecta un canonical que apunta a otra URL, que es el error caro y silencioso', () => {
      const cruzado = page({ url: 'https://x.cl/a', parsed: parsed({ canonical: 'https://x.cl/b' }) });
      expect(canonicalCheck.run(input([cruzado]))[0].status).toBe('fail');
      const propio = page({ url: 'https://x.cl/a', parsed: parsed({ canonical: 'https://x.cl/a/' }) });
      expect(canonicalCheck.run(input([propio]))[0].status).toBe('pass');
   });

   it('una página sin imágenes no falla el check de alt: no hay nada que medir', () => {
      expect(imgAltCheck.run(input([page({ parsed: parsed({ images: 0 }) })]))[0].status).toBe('na');
      expect(imgAltCheck.run(input([page({ parsed: parsed({ images: 18, imagesWithoutAlt: 0 }) })]))[0].status).toBe('pass');
      expect(imgAltCheck.run(input([page({ parsed: parsed({ images: 18, imagesWithoutAlt: 3 }) })]))[0].status).toBe('fail');
   });

   it('caso real de Fresard: sin teléfono, sin WhatsApp y sin formulario', () => {
      const sinContacto = page({ parsed: parsed({ telLinks: 0, whatsappLinks: 0, hasForm: false }) });
      expect(contactCheck.run(input([sinContacto]))[0].status).toBe('fail');
      const conWsp = page({ parsed: parsed({ whatsappLinks: 1 }) });
      expect(contactCheck.run(input([conWsp]))[0].status).toBe('pass');
   });

   it('la meta description se mide por largo, no por presencia', () => {
      expect(metaDescriptionCheck.run(input([page({ parsed: parsed({ metaDescription: 'corta' }) })]))[0].status).toBe('fail');
      const buena = 'x'.repeat(120);
      expect(metaDescriptionCheck.run(input([page({ parsed: parsed({ metaDescription: buena }) })]))[0].status).toBe('pass');
   });

   it('cada check tiene id estable, bloque, peso y texto de ayuda', () => {
      const ids = checks.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      checks.forEach((c) => {
         expect(c.id).toMatch(/^[a-z]{3}\./);
         expect([1, 2, 3]).toContain(c.weight);
         expect(c.help.length).toBeGreaterThan(20);
      });
   });
});
