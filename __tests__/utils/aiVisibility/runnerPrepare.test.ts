/** @jest-environment node */
import {
   runInFlight, scopeLabelOf, planRun, prepareRun, executeRun,
} from '../../../utils/aiVisibility/runner';
import AiPrompt from '../../../database/models/aiPrompt';
import AiRun from '../../../database/models/aiRun';
import { dfsCall } from '../../../utils/aiVisibility/dfs';
import { monthSpend } from '../../../utils/aiVisibility/budget';

jest.mock('../../../database/models/domain', () => ({
   __esModule: true,
   default: {
      findAll: jest.fn(async () => [{ get: (k: string) => ({ domain: 'ammo.cl', ai_settings: '{"enabled":true}' } as any)[k] }]),
   },
}));
jest.mock('../../../database/models/aiPrompt', () => ({
   __esModule: true, default: { findByPk: jest.fn(), findAll: jest.fn(async () => []) },
}));
jest.mock('../../../database/models/aiRun', () => ({ __esModule: true, default: { create: jest.fn(), findAll: jest.fn(async () => []) } }));
jest.mock('../../../database/models/aiAnswer', () => ({
   __esModule: true, default: { destroy: jest.fn(), count: jest.fn(async () => 0), create: jest.fn() },
}));
jest.mock('../../../database/models/keyword', () => ({ __esModule: true, default: { count: jest.fn(async () => 0) } }));
jest.mock('../../../utils/usage', () => ({ logUsage: jest.fn() }));
jest.mock('../../../utils/aiVisibility/dfs', () => ({ dfsCall: jest.fn() }));
jest.mock('../../../utils/aiVisibility/googleIa', () => ({ runGoogleIa: jest.fn() }));
jest.mock('../../../utils/aiVisibility/budget', () => {
   const actual = jest.requireActual('../../../utils/aiVisibility/budget');
   return { ...actual, monthSpend: jest.fn(async () => 0) };
});

const prompt = (active: boolean) => {
   const row: Record<string, unknown> = { ID: 3, domain: 'ammo.cl', prompt: 'p', tags: '[]', active };
   return { get: (k?: unknown) => (typeof k === 'string' ? row[k] : row) };
};
const fakeRun = () => { const run = { update: jest.fn(), get: () => 9 }; (AiRun.create as jest.Mock).mockResolvedValueOnce(run); return run; };
const settings = (o: Partial<SettingsType>) => o as SettingsType;

describe('runInFlight (corridas superpuestas)', () => {
   const now = new Date('2026-11-04T12:00:00Z');
   const at = (min: number) => new Date(now.getTime() - min * 60000).toJSON();
   it('bloquea una corrida pendiente del mismo alcance de hace menos de 30 minutos', () => {
      expect(runInFlight([{ scope: 'domain:ammo.cl', status: 'pending', started_at: at(29) }], 'domain:ammo.cl', now)).toBe(true);
   });
   it('no bloquea si es de otro alcance, ya cerró o es más vieja que 30 minutos', () => {
      expect(runInFlight([{ scope: 'prompt:3', status: 'pending', started_at: at(1) }], 'domain:ammo.cl', now)).toBe(false);
      expect(runInFlight([{ scope: 'domain:ammo.cl', status: 'done', started_at: at(1) }], 'domain:ammo.cl', now)).toBe(false);
      expect(runInFlight([{ scope: 'domain:ammo.cl', status: 'pending', started_at: at(31) }], 'domain:ammo.cl', now)).toBe(false);
   });
   it('etiqueta del alcance', () => {
      expect(scopeLabelOf({ kind: 'all' })).toBe('all');
      expect(scopeLabelOf({ kind: 'prompt', promptId: 3 })).toBe('prompt:3');
      expect(scopeLabelOf({ kind: 'domain', domain: 'ammo.cl' })).toBe('domain:ammo.cl');
   });
});

describe('planRun · prompt desactivado', () => {
   it('un prompt activo se planifica; uno desactivado no', async () => {
      (AiPrompt.findByPk as jest.Mock).mockResolvedValueOnce(prompt(true));
      expect((await planRun({ kind: 'prompt', promptId: 3 }, 'live')).prompts).toHaveLength(1);
      (AiPrompt.findByPk as jest.Mock).mockResolvedValueOnce(prompt(false));
      const plan = await planRun({ kind: 'prompt', promptId: 3 }, 'live');
      expect(plan.prompts).toHaveLength(0);
      expect(plan.estimate).toBe(0);
   });
});

describe('prepareRun / executeRun', () => {
   beforeEach(() => { jest.clearAllMocks(); (AiPrompt.findByPk as jest.Mock).mockResolvedValue(prompt(true)); });

   it('sin credenciales: omite de forma síncrona y no llama a nada', async () => {
      const run = fakeRun();
      const prep = await prepareRun({ kind: 'prompt', promptId: 3 }, 'live', 'user:1', settings({}));
      expect(prep.status).toBe('skipped_no_credentials');
      expect(run.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'skipped_no_credentials' }));
      expect(dfsCall).not.toHaveBeenCalled();
   });

   it('sobre el tope: omite de forma síncrona', async () => {
      (monthSpend as jest.Mock).mockResolvedValueOnce(5);
      fakeRun();
      const s = settings({ ai_dataforseo_credentials: 'a@b.cl:x', ai_monthly_budget_usd: 2 });
      const prep = await prepareRun({ kind: 'prompt', promptId: 3 }, 'live', 'user:1', s);
      expect(prep.status).toBe('skipped_budget');
      expect(dfsCall).not.toHaveBeenCalled();
   });

   it('con todo en orden crea la corrida pendiente sin consultar; executeRun hace las llamadas', async () => {
      fakeRun();
      const prep = await prepareRun({ kind: 'prompt', promptId: 3 }, 'live', 'user:1', settings({ ai_dataforseo_credentials: 'a@b.cl:x' }));
      expect(prep.status).toBe('pending');
      expect(prep.runId).toBe(9);
      expect(dfsCall).not.toHaveBeenCalled();
      (dfsCall as jest.Mock).mockResolvedValue({ ok: false, cost: 0, error: 'x' });
      await executeRun(prep);
      expect(dfsCall).toHaveBeenCalled();
   });
});
