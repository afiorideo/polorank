import { citationRatio, citationPeriods } from '../../utils/aiTracking';
import type { DailyCite } from '../../utils/aiTracking';

const HOY = new Date(2026, 8, 28); // 28 de septiembre de 2026
const dia = (d: number, estado: number): DailyCite => ({ date: `2026-9-${d}`, ai_cited: estado });

describe('Tracking IA · proporción de citas', () => {
   it('cuenta citas sobre oportunidades, no sobre días del calendario', () => {
      // 5 días: 3 con resumen (2 citado, 1 no) y 2 sin resumen
      const rows = [dia(28, 1), dia(27, 1), dia(26, 0), dia(25, -1), dia(24, -1)];
      expect(citationRatio(rows, 7, HOY)).toEqual({ cited: 2, chances: 3 });
   });

   it('REGLA: los días sin resumen no cuentan ni a favor ni en contra', () => {
      const conHuecos = [dia(28, 1), dia(27, -1), dia(26, -1), dia(25, -1)];
      expect(citationRatio(conHuecos, 7, HOY)).toEqual({ cited: 1, chances: 1 });
   });

   it('devuelve null cuando no hubo ni una oportunidad en el período', () => {
      expect(citationRatio([dia(28, -1), dia(27, -1)], 7, HOY)).toBeNull();
      expect(citationRatio([], 7, HOY)).toBeNull();
   });

   it('cero citas con oportunidades es 0 de N, que no es lo mismo que null', () => {
      expect(citationRatio([dia(28, 0), dia(27, 0)], 7, HOY)).toEqual({ cited: 0, chances: 2 });
   });

   it('ignora lo que cae fuera de la ventana', () => {
      const viejo = [{ date: '2026-7-1', ai_cited: 1 }, dia(28, 0)];
      expect(citationRatio(viejo, 7, HOY)).toEqual({ cited: 0, chances: 1 });
      expect(citationRatio(viejo, 90, HOY)).toEqual({ cited: 1, chances: 2 });
   });

   it('la ventana de 7 días incluye hoy y los 6 anteriores', () => {
      const rows = [dia(28, 1), dia(22, 1), dia(21, 1)];
      expect(citationRatio(rows, 7, HOY)).toEqual({ cited: 2, chances: 2 }); // 28 y 22, no el 21
   });

   it('tolera fechas con formato roto sin romperse', () => {
      expect(citationRatio([{ date: 'basura', ai_cited: 1 }, dia(28, 1)], 7, HOY)).toEqual({ cited: 1, chances: 1 });
   });

   it('citationPeriods arma los cuatro períodos de la tabla', () => {
      const p = citationPeriods([dia(28, 1), dia(20, 0)], HOY);
      expect(p.d7).toEqual({ cited: 1, chances: 1 });
      expect(p.d30).toEqual({ cited: 1, chances: 2 });
      expect(p.d90).toEqual({ cited: 1, chances: 2 });
   });

   it('caso real: sin datos hacia atrás, 90d queda en null hasta que se acumulen', () => {
      expect(citationPeriods([dia(28, 1)], HOY).d90).toEqual({ cited: 1, chances: 1 });
      expect(citationPeriods([], HOY).d90).toBeNull();
   });
});
