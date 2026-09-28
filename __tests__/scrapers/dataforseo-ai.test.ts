import fs from 'fs';
import path from 'path';
import { extractAiOverview, citedPosition } from '../../scrapers/services/dataforseo';

const real = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/serp-con-ai-overview.json'), 'utf8'));

/** Envuelve una lista de items en la forma que devuelve DataForSEO. */
const respuesta = (items: unknown[]) => ({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ items }] }] });

describe('DataForSEO · resumen con IA', () => {
   describe('extractAiOverview', () => {
      it('lee el bloque real de "madera de roble": texto y 6 fuentes', () => {
         const aio = extractAiOverview(real);
         expect(aio).not.toBeNull();
         expect(aio?.references).toHaveLength(6);
         expect(aio?.text).toContain('madera de roble');
         expect(aio?.references[0]).toMatchObject({ position: 1, source: 'Sodimac', domain: 'www.sodimac.cl' });
         expect(aio?.references.map((r) => r.domain)).toContain('www.maderastranapuente.cl');
      });

      it('devuelve null cuando la SERP no trae resumen con IA', () => {
         expect(extractAiOverview(respuesta([{ type: 'organic', url: 'https://x.cl/', title: 'x' }]))).toBeNull();
      });

      it('REGLA: un resumen que carga aparte NO es "no te citan" — devuelve null para que quede sin medir', () => {
         const async = respuesta([{ type: 'ai_overview', asynchronous_ai_overview: true, references: [] }]);
         expect(extractAiOverview(async)).toBeNull();
      });

      it('tolera un bloque sin referencias sin romperse', () => {
         const aio = extractAiOverview(respuesta([{ type: 'ai_overview', asynchronous_ai_overview: false, markdown: 'texto' }]));
         expect(aio).toEqual({ text: 'texto', references: [] });
      });

      it('no se rompe con una respuesta vacía o inválida', () => {
         expect(extractAiOverview(null)).toBeNull();
         expect(extractAiOverview('{}')).toBeNull();
         expect(extractAiOverview('no es json')).toBeNull();
      });
   });

   describe('citedPosition', () => {
      const refs = extractAiOverview(real)?.references || [];

      it('encuentra el puesto del dominio entre las fuentes citadas', () => {
         expect(citedPosition(refs, 'sodimac.cl')).toBe(1);
         expect(citedPosition(refs, 'maderastranapuente.cl')).toBe(2);
         expect(citedPosition(refs, 'maderanativachile.cl')).toBe(3);
      });

      it('caso real: maderasfresard.com no está citado', () => {
         expect(citedPosition(refs, 'maderasfresard.com')).toBe(0);
      });

      it('ignora el www y las mayúsculas, igual que el resto del sistema', () => {
         expect(citedPosition(refs, 'www.Sodimac.CL')).toBe(1);
         expect(citedPosition(refs, 'SODIMAC.cl')).toBe(1);
      });

      it('no confunde un dominio que termina igual que otro', () => {
         expect(citedPosition(refs, 'nosodimac.cl')).toBe(0);
         expect(citedPosition(refs, 'sodimac.cl.ar')).toBe(0);
      });

      it('devuelve 0 con una lista vacía', () => {
         expect(citedPosition([], 'x.cl')).toBe(0);
      });
   });
});
