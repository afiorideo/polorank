import type { Engine } from '../../utils/aiVisibility/budget';

export const ENGINE_ORDER: Engine[] = ['chatgpt', 'gemini', 'ai_mode', 'perplexity'];
export const ENGINE_LABEL: Record<Engine, string> = {
   chatgpt: 'ChatGPT', gemini: 'Gemini', ai_mode: 'Modo IA de Google', perplexity: 'Perplexity',
};
