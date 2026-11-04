/**
 * PoloRank — los 4 motores de Visibilidad IA: endpoint, tarea y lectura de la respuesta.
 * Estructuras verificadas con respuestas reales (piloto 2026-11-04 y Task 1).
 * AI Mode (Task 1): live cuesta US$0,004; result[0].items trae un único tipo de ítem, `ai_overview`,
 * con `markdown` (texto) y `references[]` (url, domain, title, source).
 * Gemini (cola estándar): task_post -> 20100, listo tras ~90-105 s; mientras está en cola task_get
 * devuelve status_code 40602 "Task In Queue."; el texto va en result[0].markdown (ítem `gemini_text`).
 */
import type { AiTarget } from './config';
import type { Engine } from './budget';

export type ParsedSource = { domain: string, url: string, title: string };
export type ParsedAnswer = { text: string, sources: ParsedSource[], fanOut: string[], entities: string[] };

const host = (u: string): string => (u || '').replace(/^https?:\/\//, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
const src = (arr: any[] | null | undefined): ParsedSource[] => (arr || [])
   .filter((s) => s && s.url)
   .map((s) => ({ domain: host(s.url), url: s.url, title: s.title || '' }));
const uniq = (s: ParsedSource[]): ParsedSource[] => s.filter((x, i) => s.findIndex((y) => y.url === x.url) === i);

const parseScraper = (r: any): ParsedAnswer => ({
   text: r?.markdown || '',
   sources: uniq([...src(r?.sources), ...src(r?.search_results)]),
   fanOut: r?.fan_out_queries || [],
   entities: (r?.brand_entities || []).map((b: any) => b.title).filter(Boolean),
});

const parseResponses = (r: any): ParsedAnswer => {
   const sections = (r?.items || []).flatMap((it: any) => it.sections || []);
   return {
      text: sections.map((s: any) => s.text || '').join('\n'),
      sources: uniq([...src(sections.flatMap((s: any) => s.annotations || [])), ...src(r?.search_results)]),
      fanOut: r?.fan_out_queries || [],
      entities: [],
   };
};

const parseAiMode = (r: any): ParsedAnswer => {
   const items = (r?.items || []).filter((i: any) => i.type === 'ai_overview');
   return {
      text: items.map((i: any) => i.markdown || '').join('\n'),
      sources: uniq(src(items.flatMap((i: any) => i.references || []))),
      fanOut: [],
      entities: [],
   };
};

type EngineDef = {
   live: string, post?: string, get?: (id: string) => string,
   task: (prompt: string, t: AiTarget) => Record<string, unknown>, parse: (result: any) => ParsedAnswer,
};

export const ENGINE_DEF: Record<Engine, EngineDef> = {
   chatgpt: {
      live: '/ai_optimization/chat_gpt/llm_scraper/live/advanced',
      post: '/ai_optimization/chat_gpt/llm_scraper/task_post',
      get: (id) => `/ai_optimization/chat_gpt/llm_scraper/task_get/advanced/${id}`,
      task: (q, t) => ({ keyword: q, location_code: t.location_code, language_code: t.language_code }),
      parse: parseScraper,
   },
   gemini: {
      live: '/ai_optimization/gemini/llm_scraper/live/advanced',
      post: '/ai_optimization/gemini/llm_scraper/task_post',
      get: (id) => `/ai_optimization/gemini/llm_scraper/task_get/advanced/${id}`,
      task: (q, t) => ({ keyword: q, location_code: t.gemini_location_code, language_code: t.language_code }),
      parse: parseScraper,
   },
   ai_mode: {
      live: '/serp/google/ai_mode/live/advanced',
      post: '/serp/google/ai_mode/task_post',
      get: (id) => `/serp/google/ai_mode/task_get/advanced/${id}`,
      task: (q, t) => ({ keyword: q, location_code: t.location_code, language_code: t.language_code, device: 'mobile' }),
      parse: parseAiMode,
   },
   perplexity: {
      // Sonar no admite cola: siempre live
      live: '/ai_optimization/perplexity/llm_responses/live',
      task: (q, t) => ({ user_prompt: q, model_name: 'sonar', web_search_country_iso_code: t.country_iso }),
      parse: parseResponses,
   },
};
export default ENGINE_DEF;
