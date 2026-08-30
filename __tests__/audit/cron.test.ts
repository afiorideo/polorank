/**
 * @jest-environment node
 */
import handler from '../../pages/api/audit/cron';

jest.mock('../../database/database', () => ({ __esModule: true, default: { sync: jest.fn() } }));
jest.mock('../../database/models/domain', () => ({ __esModule: true, default: { findAll: jest.fn() } }));
jest.mock('../../database/models/keyword', () => ({ __esModule: true, default: { count: jest.fn() } }));
jest.mock('../../utils/verifyUser', () => ({ authenticate: jest.fn() }));
jest.mock('../../utils/audit/run', () => ({ auditDomain: jest.fn() }));
// la pausa entre dominios es real en produccion; en el test no tiene sentido esperarla
jest.mock('../../utils/audit/sleep', () => ({ sleep: jest.fn(() => Promise.resolve()) }));

/* eslint-disable global-require */
const Keyword = require('../../database/models/keyword').default;
const Domain = require('../../database/models/domain').default;
const { authenticate } = require('../../utils/verifyUser');
const { auditDomain } = require('../../utils/audit/run');

const res = () => {
   const r: any = {};
   r.status = jest.fn(() => r);
   r.json = jest.fn((body) => { r.body = body; return r; });
   return r;
};
const req = (method = 'POST') => ({ method } as any);

describe('auditoría · corrida semanal', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(console, 'log').mockImplementation(() => {});
      authenticate.mockResolvedValue({ authorized: true, viaApiKey: true });
      Keyword.count.mockResolvedValue(0);
      Domain.findAll.mockResolvedValue([]);
   });
   afterEach(() => jest.restoreAllMocks());

   it('REGLA: no arranca si hay un scrape de posiciones en curso — el tracking siempre gana', async () => {
      Keyword.count.mockResolvedValue(3);
      const r = res();
      await handler(req(), r);
      expect(r.status).toHaveBeenCalledWith(200);
      expect(r.body).toMatchObject({ skipped: true });
      expect(auditDomain).not.toHaveBeenCalled();
   });

   it('audita los dominios de a uno, no todos a la vez', async () => {
      const enCurso: string[] = [];
      Domain.findAll.mockResolvedValue([
         { get: () => 'a.cl' }, { get: () => 'b.cl' },
      ]);
      auditDomain.mockImplementation(async (row: any) => {
         enCurso.push(row.get('domain'));
         expect(enCurso.length).toBe(1); // si fueran en paralelo, habría dos a la vez
         await new Promise((r) => { setTimeout(r, 5); });
         enCurso.pop();
         return { ok: true, runId: 1 };
      });
      const r = res();
      await handler(req(), r);
      expect(auditDomain).toHaveBeenCalledTimes(2);
      expect(r.body).toMatchObject({ audited: 2 });
   });

   it('el fallo de un dominio no impide auditar los demás', async () => {
      Domain.findAll.mockResolvedValue([{ get: () => 'a.cl' }, { get: () => 'b.cl' }]);
      auditDomain
         .mockResolvedValueOnce({ ok: false, error: 'sitio caído' })
         .mockResolvedValueOnce({ ok: true, runId: 2 });
      const r = res();
      await handler(req(), r);
      expect(r.body.results).toEqual([
         { domain: 'a.cl', ok: false, error: 'sitio caído' },
         { domain: 'b.cl', ok: true, error: undefined },
      ]);
   });

   it('rechaza sin autenticación', async () => {
      authenticate.mockResolvedValue({ authorized: false, error: 'no autorizado' });
      const r = res();
      await handler(req(), r);
      expect(r.status).toHaveBeenCalledWith(401);
   });
});
