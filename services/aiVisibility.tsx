import toast from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import type { AiVisibilityData } from '../utils/aiVisibility/panel';
import type { AiDomainSettings } from '../utils/aiVisibility/config';

export type { AiVisibilityData, EngineCell } from '../utils/aiVisibility/panel';

export type AiPromptRow = { ID: number, domain: string, prompt: string, tags: string, active: boolean };
export type AiRunScope = { scope: 'prompt', id: number } | { scope: 'domain' | 'google', domain: string };
/** Una respuesta completa de una IA (última semana), tal como la guarda `ai_answer` sin el campo `raw`. */
export type AiFullAnswer = {
   ID: number, prompt_id: number, engine: string, rep: number, status: string, mentioned: number, cited: number,
   position: number, brands: string, sources: string, fan_out: string, text: string,
};

const jsonHeaders = () => new Headers({ 'Content-Type': 'application/json', Accept: 'application/json' });

const readError = async (res: Response, fallback: string) => {
   try { const data = await res.json(); return data?.error || fallback; } catch (e) { return fallback; }
};

const api = async <T, >(url: string, init: RequestInit | undefined, fallback: string): Promise<T> => {
   const res = await fetch(`${window.location.origin}${url}`, init);
   if (!res.ok) { throw new Error(await readError(res, fallback)); }
   return res.json();
};

const runQuery = (s: AiRunScope) => (s.scope === 'prompt'
   ? `scope=prompt&id=${s.id}`
   : `scope=${s.scope}&domain=${encodeURIComponent(s.domain)}`);

/** Panel de Visibilidad IA de un dominio. */
export function useFetchAiVisibility(domain: string | undefined) {
   return useQuery(['aiVisibility', domain], () => api<AiVisibilityData>(
      `/api/ai-visibility/data?domain=${encodeURIComponent(domain || '')}`, undefined, 'No se pudo cargar la visibilidad en IAs',
   ), { enabled: !!domain });
}

/** Respuestas completas (con texto) de un prompt, de la última semana. */
export function useAiPromptAnswers(domain: string | undefined, promptId: number | null) {
   return useQuery(['aiVisibility', domain, 'answers', promptId], () => api<{ week: string | null, answers: AiFullAnswer[] }>(
      `/api/ai-visibility/data?domain=${encodeURIComponent(domain || '')}&prompt=${promptId}&full=1`,
      undefined,
      'No se pudieron cargar las respuestas',
   ), { enabled: !!domain && promptId !== null });
}

/** Estimado de costo de una corrida en vivo (GET /run). */
export function useAiRunEstimate() {
   return useMutation((s: AiRunScope) => api<{ estimate: number }>(
      `/api/ai-visibility/run?${runQuery(s)}`, { method: 'GET' }, 'No se pudo calcular el costo',
   ), { onError: (error: Error) => { toast(error.message, { icon: '⚠️' }); } });
}

/** Lanza una corrida en vivo (POST /run, solo superadmin, con espera de 10 minutos). */
export function useRunAiNow(domain: string | undefined) {
   const queryClient = useQueryClient();
   return useMutation((s: AiRunScope) => api<unknown>(
      `/api/ai-visibility/run?${runQuery(s)}`, { method: 'POST' }, 'No se pudo iniciar la actualización',
   ), {
      onSuccess: () => {
         toast('Actualización iniciada. Los resultados irán apareciendo en unos minutos.', { icon: '✔️' });
         queryClient.invalidateQueries(['aiVisibility', domain]);
      },
      onError: (error: Error) => { toast(error.message, { icon: '⚠️' }); },
   });
}

export function useAiPrompts(domain: string | undefined) {
   return useQuery(['aiVisibility', domain, 'prompts'], () => api<{ prompts: AiPromptRow[], max: number }>(
      `/api/ai-visibility/prompts?domain=${encodeURIComponent(domain || '')}`, undefined, 'No se pudieron cargar los prompts',
   ), { enabled: !!domain });
}

export function useSaveAiPrompt(domain: string | undefined) {
   const queryClient = useQueryClient();
   return useMutation(async (p: { id?: number, prompt: string, tags: string[] }) => api<{ prompt: AiPromptRow }>(
      `/api/ai-visibility/prompts?domain=${encodeURIComponent(domain || '')}`,
      {
         method: p.id ? 'PUT' : 'POST',
         headers: jsonHeaders(),
         body: JSON.stringify(p.id ? { id: p.id, prompt: p.prompt, tags: p.tags } : { prompt: p.prompt, tags: p.tags }),
      },
      'No se pudo guardar el prompt',
   ), {
      onSuccess: () => { toast('Prompt guardado', { icon: '✔️' }); queryClient.invalidateQueries(['aiVisibility', domain]); },
      onError: (error: Error) => { toast(error.message, { icon: '⚠️' }); },
   });
}

/** Desactiva el prompt (no borra el historial). */
export function useDeleteAiPrompt(domain: string | undefined) {
   const queryClient = useQueryClient();
   return useMutation((id: number) => api<{ deleted: boolean }>(
      `/api/ai-visibility/prompts?domain=${encodeURIComponent(domain || '')}&id=${id}`, { method: 'DELETE' }, 'No se pudo eliminar el prompt',
   ), {
      onSuccess: () => { toast('Prompt eliminado', { icon: '✔️' }); queryClient.invalidateQueries(['aiVisibility', domain]); },
      onError: (error: Error) => { toast(error.message, { icon: '⚠️' }); },
   });
}

export function useAiConfig(domain: string | undefined) {
   return useQuery(['aiVisibility', domain, 'config'], () => api<{ settings: AiDomainSettings }>(
      `/api/ai-visibility/config?domain=${encodeURIComponent(domain || '')}`, undefined, 'No se pudo cargar la configuración',
   ), { enabled: !!domain });
}

export function useSaveAiConfig(domain: string | undefined) {
   const queryClient = useQueryClient();
   return useMutation((settings: AiDomainSettings) => api<{ settings: AiDomainSettings }>(
      `/api/ai-visibility/config?domain=${encodeURIComponent(domain || '')}`,
      { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify({ settings }) },
      'No se pudo guardar la configuración',
   ), {
      onSuccess: () => { toast('Configuración guardada', { icon: '✔️' }); queryClient.invalidateQueries(['aiVisibility', domain]); },
      onError: (error: Error) => { toast(error.message, { icon: '⚠️' }); },
   });
}
