/**
 * @jest-environment node
 *
 * El analizador es código de servidor y usa cheerio, que bajo jsdom resuelve su build ESM y no carga.
 */
import fs from 'fs';
import path from 'path';
import { parsePage, schemaTypesOf } from '../../utils/audit/parse';

const fresard = fs.readFileSync(path.join(__dirname, 'fixtures/fresard-home.html'), 'utf8');

describe('auditoría · análisis del HTML', () => {

   describe('schemaTypesOf', () => {
      it('lee @type cuando es un array — el caso que hace fallar al análisis ingenuo', () => {
         const json = { '@type': ['LocalBusiness', 'Organization'], name: 'X' };
         expect(schemaTypesOf(json)).toEqual(['LocalBusiness', 'Organization']);
      });

      it('entra en @graph, que es donde WordPress esconde los tipos útiles', () => {
         const json = { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite' }, { '@type': ['LocalBusiness'] }] };
         expect(schemaTypesOf(json)).toEqual(['WebSite', 'LocalBusiness']);
      });

      it('no se rompe con formas raras', () => {
         expect(schemaTypesOf(null)).toEqual([]);
         expect(schemaTypesOf([{ '@type': 'A' }, { '@type': 'A' }])).toEqual(['A']);
      });
   });

   describe('sobre el HTML real de maderasfresard.com', () => {
      const p = parsePage(fresard, 'https://maderasfresard.com/');

      it('extrae title, H1 y meta description', () => {
         expect(p.title).toBe('Maderas del Sur de Chile en Villarrica | Maderas Fresard');
         expect(p.h1).toEqual(['Venta de maderas del sur de Chile']);
         expect(p.metaDescription).toContain('Venta de maderas del sur de Chile');
      });

      it('detecta el schema LocalBusiness pese a venir como array dentro de @graph', () => {
         expect(p.schemaTypes).toContain('LocalBusiness');
         expect(p.schemaTypes).toContain('Organization');
      });

      it('confirma que la página es indexable y tiene canonical', () => {
         expect(p.indexable).toBe(true);
         expect(p.canonical).toBe('https://maderasfresard.com/');
      });

      it('cuenta las imágenes y verifica que todas tienen alt', () => {
         expect(p.images).toBeGreaterThan(10);
         expect(p.imagesWithoutAlt).toBe(0);
      });

      it('el contenido principal pesa menos que el documento entero: el menú y el footer no cuentan', () => {
         expect(p.wordCount).toBeLessThan(p.wordCountAll);
         expect(p.wordCount).toBeLessThan(300);
      });

      it('encuentra los enlaces internos hacia las páginas de producto', () => {
         expect(p.internalLinks.some((u) => u.includes('/madera-aserrada/'))).toBe(true);
         expect(p.internalLinks.some((u) => u.includes('/contacto/'))).toBe(true);
      });

      it('confirma el hallazgo de negocio: ni teléfono ni WhatsApp en la home', () => {
         expect(p.telLinks).toBe(0);
         expect(p.whatsappLinks).toBe(0);
      });
   });

   describe('casos que hacen mentir a una auditoría', () => {
      it('un H2 en el footer no contamina el contenido principal', () => {
         const html = '<html><body><main><p>uno dos tres</p></main><footer><h2>Copyright 2025</h2></footer></body></html>';
         const p = parsePage(html, 'https://x.cl/');
         expect(p.wordCount).toBe(3);
      });

      it('detecta noindex', () => {
         const html = '<html><head><meta name="robots" content="noindex, follow"></head><body>x</body></html>';
         expect(parsePage(html, 'https://x.cl/').indexable).toBe(false);
      });

      it('separa enlaces internos de externos ignorando el www y los anclas', () => {
         const html = '<html><body><a href="/a">a</a><a href="https://www.x.cl/b#s">b</a><a href="https://otro.cl/">c</a>'
            + '<a href="mailto:h@x.cl">m</a></body></html>';
         const p = parsePage(html, 'https://x.cl/');
         expect(p.internalLinks).toEqual(['https://x.cl/a', 'https://www.x.cl/b']);
         expect(p.externalLinks).toBe(1);
      });

      it('un JSON-LD roto no cuenta como tipo declarado, y no rompe el análisis', () => {
         const html = '<html><body><script type="application/ld+json">{roto</script></body></html>';
         expect(parsePage(html, 'https://x.cl/').schemaTypes).toEqual([]);
      });
   });
});
