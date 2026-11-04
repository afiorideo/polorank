/** @jest-environment node */
import { buildPanel } from '../../../utils/aiVisibility/panel';

const ans = (engine: string, rep: number, mentioned: number, position: number, brands: string[], week = '2026-11-09') => ({
   prompt_id: 1,
engine,
rep,
week,
status: 'ok',
mentioned,
cited: mentioned,
position,
   brands: JSON.stringify(brands),
sources: JSON.stringify([{ domain: 'ammo.cl', url: 'https://ammo.cl/', title: '' }]),
});

const prompts = [{ ID: 1, prompt: 'x', tags: '["arriendo"]' }] as any;

it('celda 3/3 · #1 y competidor contado', () => {
   const answers = [1, 2, 3].map((r) => ans('chatgpt', r, 1, 1, ['Ammo', 'Armario de la Karo']))
      .concat([1, 2, 3].map((r) => ans('perplexity', r, 0, 0, ['Armario de la Karo'])));
   const p = buildPanel(prompts, answers as any, ['2026-11-09'], 'Ammo');
   expect(p.prompts[0].cells.chatgpt).toEqual({ mentioned: 3, total: 3, bestPosition: 1, cited: 3 });
   expect(p.prompts[0].cells.perplexity.mentioned).toBe(0);
   expect(p.competitors[0]).toMatchObject({ name: 'Armario de la Karo', total: 6 });
   expect(p.byEngine.chatgpt).toMatchObject({ prompts: 1, promptsWithMention: 1, answers: 3, mentioned: 3 });
   expect(p.prompts[0].deltaVsPrev).toBeNull();
   expect(p.sources.chatgpt[0]).toEqual({ domain: 'ammo.cl', count: 3 });
});

it('delta vs semana previa, evolución en orden cronológico y errores ignorados', () => {
   const answers = [
      ans('chatgpt', 1, 1, 1, ['Ammo', 'Karo'], '2026-11-09'), ans('chatgpt', 2, 1, 1, ['Ammo'], '2026-11-09'),
      ans('chatgpt', 1, 1, 1, ['Karo'], '2026-11-02'), ans('chatgpt', 2, 0, 0, ['Karo'], '2026-11-02'),
      { ...ans('chatgpt', 3, 1, 1, ['Ammo'], '2026-11-09'), status: 'error' },
   ];
   const p = buildPanel(prompts, answers as any, ['2026-11-09', '2026-11-02'], 'Ammo');
   expect(p.prompts[0].deltaVsPrev).toBe(1);
   expect(p.totals.answers).toBe(2);
   expect(p.evolution.map((e) => e.week)).toEqual(['2026-11-02', '2026-11-09']);
   expect(p.evolution[0]).toMatchObject({ ownRate: 0.5, topCompetitor: 'Karo', competitorRate: 1 });
});
