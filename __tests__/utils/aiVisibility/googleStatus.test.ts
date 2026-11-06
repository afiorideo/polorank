/** @jest-environment node */
import { pickGoogleRuns } from '../../../utils/aiVisibility/googleStatus';

const now = new Date('2026-11-06T01:00:00Z');
const run = (ID: number, status: string, started: string, finished = '') => ({ ID, status, started_at: started, finished_at: finished });

describe('pickGoogleRuns', () => {
   it('toma la última corrida terminada (done o partial) como última medición', () => {
      const out = pickGoogleRuns([
         run(5, 'done', '2026-11-06T00:44:05Z', '2026-11-06T00:44:56Z'),
         run(4, 'done', '2026-11-05T17:41:04Z', '2026-11-05T17:41:53Z'),
      ], now);
      expect(out.last?.ID).toBe(5);
      expect(out.inProgress).toBe(false);
   });
   it('una corrida pendiente reciente = en curso; las omitidas no cuentan como medición', () => {
      const out = pickGoogleRuns([
         run(7, 'pending', '2026-11-06T00:55:00Z'),
         run(6, 'skipped_budget', '2026-11-06T00:50:00Z', '2026-11-06T00:50:00Z'),
         run(5, 'partial', '2026-11-06T00:44:05Z', '2026-11-06T00:44:56Z'),
      ], now);
      expect(out.inProgress).toBe(true);
      expect(out.last?.ID).toBe(5);
   });
   it('una pendiente de hace más de 30 minutos no se muestra como en curso', () => {
      expect(pickGoogleRuns([run(7, 'pending', '2026-11-06T00:20:00Z')], now)).toEqual({ last: null, inProgress: false });
   });
});
