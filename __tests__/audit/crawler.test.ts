/**
 * @jest-environment node
 */
import { fetchPage, toCrawledPage, crawlSite, DEFAULT_LIMITS, CRAWLER_HEADERS } from '../../utils/audit/crawler';
import type { FetchFn } from '../../utils/audit/crawler';

const html = (body: string, head = ''): string => `<html><head>${head}</head><body>${body}${'<!-- '.padEnd(2200, 'x')}--></body></html>`;

/** Fake fetch driven by a URL → response map. Honra la señal de aborto, como el fetch real. */
const fakeFetch = (map: Record<string, { status?: number, body?: string, delayMs?: number }>): FetchFn => (
   (url, init) => new Promise((resolve, reject) => {
      const entry = map[url.replace(/\/+$/, '')] || map[url];
      if (!entry) { reject(new Error('ENOTFOUND')); return; }
      const timer = setTimeout(() => resolve(new Response(entry.body ?? '', { status: entry.status ?? 200 })), entry.delayMs || 0);
      init.signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('The operation was aborted.')); });
   })
);

describe('auditoría · crawler', () => {

   it('manda cabeceras de navegador completas — sin Accept/Accept-Language un WAF rechaza la request', () => {
      expect(CRAWLER_HEADERS.Accept).toContain('text/html');
      expect(CRAWLER_HEADERS['Accept-Language']).toContain('es');
      expect(CRAWLER_HEADERS['User-Agent']).toContain('PoloRank');
   });

   it('una página que no se pudo leer NO se convierte en un cero: se marca no medible', async () => {
      const res = await fetchPage('https://x.cl/', DEFAULT_LIMITS, fakeFetch({ 'https://x.cl': { status: 406, body: 'Not Acceptable!' } }));
      expect(res.ok).toBe(false);
      expect(res.error).toBe('HTTP 406');
      const page = toCrawledPage(res, 0);
      expect(page.fetchedOk).toBe(false);
      expect(page.wordCount).toBe(0);   // no se inventa contenido
      expect(page.title).toBe('');
   });

   it('una respuesta demasiado corta tampoco puntúa: no puede ser una página real', async () => {
      const res = await fetchPage('https://x.cl/', DEFAULT_LIMITS, fakeFetch({ 'https://x.cl': { body: '<html></html>' } }));
      expect(res.ok).toBe(false);
      expect(res.error).toContain('demasiado corta');
   });

   it('corta por tiempo agotado en vez de colgarse', async () => {
      const res = await fetchPage(
         'https://lento.cl/',
         { ...DEFAULT_LIMITS, timeoutMs: 30 },
         fakeFetch({ 'https://lento.cl': { body: html('<p>hola</p>'), delayMs: 300 } }),
      );
      expect(res.ok).toBe(false);
      expect(res.statusCode).toBe(0);
   });

   it('un error de red se reporta, no se lanza', async () => {
      const res = await fetchPage('https://no-existe.cl/', DEFAULT_LIMITS, fakeFetch({}));
      expect(res.ok).toBe(false);
      expect(res.error).toContain('ENOTFOUND');
   });

   it('sigue enlaces internos y respeta el tope de páginas', async () => {
      const map: Record<string, { body: string }> = {
         'https://x.cl': { body: html('<a href="/a">a</a><a href="/b">b</a><a href="/c">c</a>') },
         'https://x.cl/a': { body: html('<a href="/d">d</a>') },
         'https://x.cl/b': { body: html('<p>b</p>') },
         'https://x.cl/c': { body: html('<p>c</p>') },
         'https://x.cl/d': { body: html('<p>d</p>') },
      };
      const r = await crawlSite({
         seeds: ['https://x.cl/'],
         limits: { maxPages: 3, courtesyMs: 0 },
         doFetch: fakeFetch(map),
      });
      expect(r.pages).toHaveLength(3);
      expect(r.stoppedBy).toBe('maxPages');
      expect(r.pages[0].url).toBe('https://x.cl/'); // la home siempre primero
   });

   it('las semillas se visitan antes que lo descubierto: si el tope corta, la home y las landings ya están', async () => {
      const map: Record<string, { body: string }> = {
         'https://x.cl': { body: html('<a href="/basura1">1</a><a href="/basura2">2</a>') },
         'https://x.cl/landing': { body: html('<p>landing</p>') },
         'https://x.cl/basura1': { body: html('<p>1</p>') },
         'https://x.cl/basura2': { body: html('<p>2</p>') },
      };
      const r = await crawlSite({
         seeds: ['https://x.cl/', 'https://x.cl/landing'],
         limits: { maxPages: 2, courtesyMs: 0 },
         doFetch: fakeFetch(map),
      });
      expect(r.pages.map((p) => p.url)).toEqual(['https://x.cl/', 'https://x.cl/landing']);
   });

   it('no visita dos veces la misma URL aunque la enlacen muchas páginas', async () => {
      const visitas: string[] = [];
      const map: Record<string, { body: string }> = {
         'https://x.cl': { body: html('<a href="/a">a</a><a href="/b">b</a>') },
         'https://x.cl/a': { body: html('<a href="/b">b</a><a href="/">home</a>') },
         'https://x.cl/b': { body: html('<a href="/a">a</a>') },
      };
      const spy: FetchFn = async (url, init) => { visitas.push(url); return fakeFetch(map)(url, init); };
      const r = await crawlSite({ seeds: ['https://x.cl/'], limits: { courtesyMs: 0 }, doFetch: spy });
      expect(r.pages).toHaveLength(3);
      expect(visitas).toHaveLength(3);
   });

   it('corta por tiempo total y lo informa', async () => {
      let t = 0;
      const map: Record<string, { body: string }> = { 'https://x.cl': { body: html('<a href="/a">a</a>') }, 'https://x.cl/a': { body: html('<p>a</p>') } };
      const r = await crawlSite({
         seeds: ['https://x.cl/'],
         limits: { courtesyMs: 0, maxDurationMs: 100 },
         doFetch: fakeFetch(map),
         now: () => { t += 80; return t; },
      });
      expect(r.stoppedBy).toBe('timeout');
   });

   it('informa cada página al terminarla, para poder guardar sin acumular todo en memoria', async () => {
      const vistas: string[] = [];
      const map: Record<string, { body: string }> = { 'https://x.cl': { body: html('<a href="/a">a</a>') }, 'https://x.cl/a': { body: html('<p>a</p>') } };
      await crawlSite({ seeds: ['https://x.cl/'], limits: { courtesyMs: 0 }, doFetch: fakeFetch(map), onPage: (p) => { vistas.push(p.url); } });
      expect(vistas).toEqual(['https://x.cl/', 'https://x.cl/a']);
   });
});
