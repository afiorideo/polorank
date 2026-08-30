/**
 * @jest-environment node
 *
 * La restricción innegociable del módulo: la auditoría NO puede afectar al seguimiento de posiciones.
 * Este test la vuelve verificable en vez de dejarla como buena intención en un documento.
 */
import fs from 'fs';
import path from 'path';

const raiz = path.join(__dirname, '../..');
const leer = (rel: string): string => fs.readFileSync(path.join(raiz, rel), 'utf8');

/** Archivos del camino crítico: si alguno importa el auditor, un bug del crawler puede tumbar el scrape. */
const CAMINO_CRITICO = ['utils/refresh.ts', 'utils/scraper.ts', 'cron.js', 'pages/api/cron.ts'];

describe('auditoría · aislamiento del seguimiento de posiciones', () => {
   it('el scraper y el cron JAMÁS importan nada de utils/audit', () => {
      CAMINO_CRITICO.forEach((archivo) => {
         const src = leer(archivo);
         const importaAuditoria = /(from|require\()\s*['"][^'"]*audit/i.test(src);
         expect({ archivo, importaAuditoria }).toEqual({ archivo, importaAuditoria: false });
      });
   });

   it('la dependencia va en un solo sentido: la auditoría sí lee datos del tracker', () => {
      const src = leer('utils/audit/run.ts');
      expect(src).toContain('models/keyword');
      expect(src).toContain('models/keywordDaily');
   });

   it('el cron dispara la auditoría por HTTP, nunca importándola: un fallo del auditor no puede tumbar el cron', () => {
      const src = leer('cron.js');
      expect(src).toContain('/api/audit/cron');
      expect(src).not.toMatch(/(from|require\()\s*['"][^'"]*utils\/audit/);
   });

   it('los checks son puros: no tocan la base ni la red', () => {
      ['utils/audit/checks/page.ts', 'utils/audit/checks/tracking.ts', 'utils/audit/scoring.ts', 'utils/audit/engine.ts'].forEach((archivo) => {
         const src = leer(archivo);
         expect(src).not.toMatch(/from\s+['"][^'"]*database/);
         expect(src).not.toMatch(/\bfetch\s*\(/);
      });
   });
});
