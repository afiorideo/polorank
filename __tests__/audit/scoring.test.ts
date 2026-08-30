import { scoreBlock, weightsFor, localWeightFor, globalScore, PROFILE_WEIGHTS } from '../../utils/audit/scoring';
import type { ScoredCheck } from '../../utils/audit/scoring';

const c = (status: ScoredCheck['status'], score: number, weight = 1): ScoredCheck => ({ status, score, weight });

describe('auditoría · motor de puntuación', () => {
   it('cumplimiento pondera por peso: un crítico vale 3 veces un menor', () => {
      const r = scoreBlock('onpage', [c('fail', 0, 3), c('pass', 1, 1)]);
      expect(r.compliance).toBe(25); // (3×0 + 1×1) / 4
   });

   it('lo no medible sale del denominador: no baja el cumplimiento, baja la cobertura', () => {
      const r = scoreBlock('onpage', [c('pass', 1), c('pass', 1), c('na', 0), c('pending_review', 0)]);
      expect(r.compliance).toBe(100); // los dos medidos pasaron
      expect(r.coverage).toBe(50); // pero solo se pudo evaluar la mitad del bloque
      expect(r.checksMeasured).toBe(2);
      expect(r.checksTotal).toBe(4);
   });

   it('100/55 y 100/95 son estados distintos — sin el segundo número el tablero mentiría', () => {
      const medio = scoreBlock('content', [c('pass', 1), c('na', 0)]);
      const casiTodo = scoreBlock('content', [c('pass', 1), c('pass', 1), c('pass', 1), c('pass', 1), c('na', 0)]);
      expect(medio.compliance).toBe(casiTodo.compliance);
      expect(medio.coverage).toBeLessThan(casiTodo.coverage);
   });

   it('un semiautomático sin confirmar topa en 0,5 y nunca llega solo al verde', () => {
      const r = scoreBlock('content', [c('partial', 0.5)]);
      expect(r.compliance).toBe(50);
   });

   it('un bloque donde no se pudo medir nada informa 0, no un 100 inventado', () => {
      const r = scoreBlock('local', [c('na', 0), c('pending_review', 0)]);
      expect(r.compliance).toBe(0);
      expect(r.coverage).toBe(0);
   });

   it('los portones topan, no restan: noindex deja el bloque en 20 aunque todo lo demás pase', () => {
      const r = scoreBlock('indexing', [c('pass', 1), c('pass', 1)], [{ name: 'noindex', blockCap: 20, globalCap: 30 }]);
      expect(r.compliance).toBe(20);
      expect(r.cappedBy).toBe('noindex');
   });

   it('el portón global tapa el score aunque las donas estén verdes', () => {
      const bloques = [scoreBlock('onpage', [c('pass', 1)]), scoreBlock('technical', [c('pass', 1)])];
      const pesos = { onpage: 20, technical: 10 };
      expect(globalScore(bloques, pesos)).toBe(100);
      expect(globalScore(bloques, pesos, [{ name: 'noindex', blockCap: 20, globalCap: 30 }])).toBe(30);
   });

   describe('pesos por perfil de negocio', () => {
      it('Local pesa 25 en un negocio local puro y 5 en un ecommerce nacional', () => {
         expect(PROFILE_WEIGHTS.local.local).toBe(25);
         expect(PROFILE_WEIGHTS.ecommerce.local).toBe(5);
      });

      it('el peso de Local se corrige con evidencia: sin mapa local en las SERPs, cae a la mitad', () => {
         expect(localWeightFor(15, 0)).toBe(7.5); // caso real de Fresard: 0 de 18 mediciones
         expect(localWeightFor(15, 1)).toBe(22.5); // mapa local siempre presente
         expect(localWeightFor(15, 0.5)).toBe(15); // la mitad de las veces: queda igual
      });

      it('los pesos salen normalizados a 100, para poder leerlos como porcentaje', () => {
         (['local', 'local_national', 'ecommerce', 'services'] as const).forEach((perfil) => {
            const total = Object.values(weightsFor(perfil, 0.5)).reduce((a, b) => a + b, 0);
            expect(Math.round(total)).toBe(100);
         });
      });

      it('lo que Local cede se reparte entre los demás, no se pierde', () => {
         const conMapa = weightsFor('local_national', 1);
         const sinMapa = weightsFor('local_national', 0);
         expect(sinMapa.local).toBeLessThan(conMapa.local);
         // el peso liberado va a los otros bloques, sobre todo a los que ya pesaban más
         expect(sinMapa.onpage).toBeGreaterThan(conMapa.onpage);
         expect(sinMapa.content).toBeGreaterThan(conMapa.content);
         expect(Math.round(Object.values(sinMapa).reduce((a, b) => a + b, 0))).toBe(100);
      });

      it('caso real de Fresard: sin mapa local en 18 mediciones, Local baja de 17 a 9', () => {
         const pesos = weightsFor('local_national', 0);
         expect(pesos.local).toBeLessThan(10);
         expect(PROFILE_WEIGHTS.local_national.local).toBe(15);
      });
   });
});
