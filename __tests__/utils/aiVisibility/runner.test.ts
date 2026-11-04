/** @jest-environment node */
import { packRaw, unpackRaw, budgetAllows, isQueuedStatus, runStatus } from '../../../utils/aiVisibility/runner';

describe('runner', () => {
   it('raw comprimido ida y vuelta', () => {
      const o = { a: 'Ammô', n: [1, 2, 3] };
      expect(unpackRaw(packRaw(o))).toEqual(o);
   });
   it('el presupuesto corta antes de llamar', () => {
      expect(budgetAllows(1.9, 0.17, 2)).toBe(false);
      expect(budgetAllows(1.0, 0.17, 2)).toBe(true);
   });
   it('reconoce una tarea aún en cola', () => {
      expect(isQueuedStatus(40602)).toBe(true);
      expect(isQueuedStatus(40601)).toBe(true);
      expect(isQueuedStatus(20000)).toBe(false);
      expect(isQueuedStatus(40501)).toBe(false);
      expect(isQueuedStatus(undefined)).toBe(false);
   });
   it('estado de cierre de la corrida', () => {
      expect(runStatus(2, 0)).toBe('pending');
      expect(runStatus(0, 3)).toBe('partial');
      expect(runStatus(0, 0)).toBe('done');
   });
});
