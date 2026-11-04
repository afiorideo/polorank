/** @jest-environment node */
import { authenticate } from '../../utils/verifyUser';

jest.mock('../../database/database', () => ({ __esModule: true, default: { sync: jest.fn() } }));
jest.mock('../../database/models/user', () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock('../../database/models/domain', () => ({ __esModule: true, default: { findByPk: jest.fn() } }));

const call = (method: string, url: string, key = 'k') => authenticate(
   { method, url, headers: { authorization: `Bearer ${key}` }, cookies: {} } as any, {} as any,
);

describe('API key · rutas de Visibilidad IA', () => {
   beforeAll(() => { process.env.APIKEY = 'k'; });

   it.each(['cron', 'collect'])('autoriza POST /api/ai-visibility/%s', async (r) => {
      expect(await call('POST', `/api/ai-visibility/${r}`)).toMatchObject({ authorized: true, viaApiKey: true });
   });

   it('no autoriza otras rutas de Visibilidad IA con la API key', async () => {
      expect((await call('POST', '/api/ai-visibility/run?scope=domain')).authorized).toBe(false);
      expect((await call('GET', '/api/ai-visibility/data?domain=a.cl')).authorized).toBe(false);
   });
});
