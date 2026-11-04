import { Op } from 'sequelize';
import ApiUsage from '../../database/models/apiUsage';

export type Engine = 'chatgpt' | 'gemini' | 'ai_mode' | 'perplexity';
export const ENGINES: Engine[] = ['chatgpt', 'gemini', 'ai_mode', 'perplexity'];
export const REPS = 3;

/**
 * US$ por llamada. AI Mode medido a 0,004 en vivo el 2026-11-04 (Task 1).
 */
export const PRICES = {
   queue: { chatgpt: 0.0012, gemini: 0.0012, ai_mode: 0.004, perplexity: 0.006 } as Record<Engine, number>,
   live: { chatgpt: 0.004, gemini: 0.004, ai_mode: 0.004, perplexity: 0.006 } as Record<Engine, number>,
   google: 0.002,
};

/** Estimado de una corrida. Google IA incluye ~40% de reintentos por páginas envenenadas. */
export const estimateCost = (prompts: number, keywords: number, mode: 'queue' | 'live', reps: number = REPS): number => {
   const perPrompt = ENGINES.reduce((s, e) => s + PRICES[mode][e], 0) * reps;
   return prompts * perPrompt + keywords * PRICES.google * 1.4;
};

/** Gasto del mes calendario (UTC) de Visibilidad IA. */
export const monthSpend = async (now: Date = new Date()): Promise<number> => {
   const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toJSON();
   const rows = await ApiUsage.findAll({ where: { scraper: { [Op.like]: 'ai:%' }, created_at: { [Op.gte]: from } } });
   return rows.reduce((s, r) => s + Number(r.get('cost_usd') || 0), 0);
};
