/** @jest-environment node */
import configHandler from '../../pages/api/ai-visibility/config';
import promptsHandler from '../../pages/api/ai-visibility/prompts';
import runHandler from '../../pages/api/ai-visibility/run';
import { authenticate } from '../../utils/verifyUser';
import AiRun from '../../database/models/aiRun';
import AiPrompt from '../../database/models/aiPrompt';
import { prepareRun, executeRun } from '../../utils/aiVisibility/runner';

jest.mock('../../database/database', () => ({ __esModule: true, default: { sync: jest.fn() } }));
jest.mock('../../utils/verifyUser', () => ({ authenticate: jest.fn() }));
jest.mock('../../pages/api/settings', () => ({
   getAppSettings: jest.fn(async () => ({ ai_max_prompts: 5, ai_dataforseo_credentials: 'a@b.cl:x' })),
}));
jest.mock('../../database/models/domain', () => ({
   __esModule: true,
   default: { findOne: jest.fn(async () => ({ get: () => '{}', update: jest.fn() })) },
}));
jest.mock('../../database/models/aiPrompt', () => ({
   __esModule: true,
   default: {
      findAll: jest.fn(async () => []),
      count: jest.fn(async () => 0),
      create: jest.fn(async (v) => ({ get: () => v })),
      findOne: jest.fn(async () => null),
      findByPk: jest.fn(async () => null),
   },
}));
jest.mock('../../database/models/aiRun', () => ({ __esModule: true, default: { findAll: jest.fn(async () => []) } }));
jest.mock('../../utils/aiVisibility/runner', () => {
   const actual = jest.requireActual('../../utils/aiVisibility/runner');
   return { ...actual, planRun: jest.fn(async () => ({ estimate: 0.1 })), prepareRun: jest.fn(), executeRun: jest.fn() };
});

const users = {
   superadmin: { uid: 1, email: 's@x.cl', role: 'superadmin', domainId: null, domain: null, domainSlug: null },
   domain_admin: { uid: 2, email: 'a@x.cl', role: 'domain_admin', domainId: 1, domain: 'ammo.cl', domainSlug: 'ammo-cl' },
   domain_user: { uid: 3, email: 'u@x.cl', role: 'domain_user', domainId: 1, domain: 'ammo.cl', domainSlug: 'ammo-cl' },
};
const as = (role: keyof typeof users) => (authenticate as jest.Mock).mockResolvedValue({
   authorized: true, error: '', user: users[role], viaApiKey: false,
});
const call = async (handler: any, method: string, query: Record<string, string>, body: unknown = {}) => {
   const res: any = { status: jest.fn(() => res), json: jest.fn(() => res) };
   await handler({ method, query, body } as any, res);
   return { code: res.status.mock.calls[0]?.[0], body: res.json.mock.calls[0]?.[0] };
};

describe('Visibilidad IA · permisos de la API', () => {
   beforeEach(() => { jest.clearAllMocks(); });

   it('config PUT: domain_user y domain_admin reciben 403; el superadmin guarda', async () => {
      const body = { settings: { enabled: true, brand_variants: ['ammo'] } };
      as('domain_user');
      expect(await call(configHandler, 'PUT', { domain: 'ammo.cl' }, body)).toMatchObject({ code: 403 });
      as('domain_admin');
      expect(await call(configHandler, 'PUT', { domain: 'ammo.cl' }, body)).toMatchObject({ code: 403 });
      as('superadmin');
      expect(await call(configHandler, 'PUT', { domain: 'ammo.cl' }, body)).toMatchObject({ code: 200 });
   });

   it('config GET sigue abierto a quien accede al dominio', async () => {
      as('domain_user');
      expect(await call(configHandler, 'GET', { domain: 'ammo.cl' })).toMatchObject({ code: 200 });
   });

   it('prompts POST/PUT/DELETE: domain_user recibe 403; GET sí puede', async () => {
      as('domain_user');
      expect(await call(promptsHandler, 'POST', { domain: 'ammo.cl' }, { prompt: 'hola' })).toMatchObject({ code: 403 });
      expect(await call(promptsHandler, 'PUT', { domain: 'ammo.cl' }, { id: 1, prompt: 'hola' })).toMatchObject({ code: 403 });
      expect(await call(promptsHandler, 'DELETE', { domain: 'ammo.cl', id: '1' })).toMatchObject({ code: 403 });
      expect(AiPrompt.create).not.toHaveBeenCalled();
      expect(await call(promptsHandler, 'GET', { domain: 'ammo.cl' })).toMatchObject({ code: 200 });
   });

   it('prompts POST: domain_admin de su dominio sí crea', async () => {
      as('domain_admin');
      expect(await call(promptsHandler, 'POST', { domain: 'ammo.cl' }, { prompt: 'hola' })).toMatchObject({ code: 200 });
      expect(AiPrompt.create).toHaveBeenCalled();
   });
});

describe('Visibilidad IA · POST /run', () => {
   beforeEach(() => { jest.clearAllMocks(); as('superadmin'); });
   const row = (o: Record<string, string>) => ({ get: (k: string) => o[k] });

   it('409 si ya hay una corrida pendiente del mismo alcance', async () => {
      (AiRun.findAll as jest.Mock).mockResolvedValueOnce([
         row({ scope: 'domain:ammo.cl', status: 'pending', started_at: new Date(Date.now() - 15 * 60000).toJSON() }),
      ]);
      const out = await call(runHandler, 'POST', { scope: 'domain', domain: 'ammo.cl' });
      expect(out).toEqual({ code: 409, body: { error: 'Ya hay una actualización en curso para este alcance' } });
      expect(prepareRun).not.toHaveBeenCalled();
   });

   it('429 dentro de la espera de 10 minutos si la corrida anterior ya cerró', async () => {
      (AiRun.findAll as jest.Mock).mockResolvedValueOnce([
         row({ scope: 'domain:ammo.cl', status: 'done', started_at: new Date(Date.now() - 2 * 60000).toJSON() }),
      ]);
      expect(await call(runHandler, 'POST', { scope: 'domain', domain: 'ammo.cl' })).toMatchObject({ code: 429 });
   });

   it('responde pending de inmediato y deja las consultas en segundo plano', async () => {
      let finish: () => void = () => {};
      (prepareRun as jest.Mock).mockResolvedValueOnce({ runId: 7, status: 'pending', estimate: 0.2, run: { update: jest.fn() } });
      (executeRun as jest.Mock).mockReturnValueOnce(new Promise<void>((r) => { finish = r; }));
      const out = await call(runHandler, 'POST', { scope: 'domain', domain: 'ammo.cl' });
      expect(out).toEqual({ code: 200, body: { runId: 7, status: 'pending', estimate: 0.2 } });
      expect(executeRun).toHaveBeenCalledTimes(1);
      finish();
   });

   it('omisión por tope se responde sin ejecutar nada', async () => {
      (prepareRun as jest.Mock).mockResolvedValueOnce({ runId: 8, status: 'skipped_budget', estimate: 0.2, run: {} });
      const out = await call(runHandler, 'POST', { scope: 'domain', domain: 'ammo.cl' });
      expect(out).toEqual({ code: 200, body: { runId: 8, status: 'skipped_budget', estimate: 0.2 } });
      expect(executeRun).not.toHaveBeenCalled();
   });

   it('no lanza un prompt desactivado', async () => {
      (AiPrompt.findByPk as jest.Mock).mockResolvedValueOnce({ get: (k: string) => ({ domain: 'ammo.cl', active: false } as any)[k] });
      expect(await call(runHandler, 'POST', { scope: 'prompt', id: '3' })).toMatchObject({ code: 404 });
   });
});
