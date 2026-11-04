import { parseCredentials } from '../../scrapers/services/dataforseo';

const BASE = process.env.DATAFORSEO_BASE || 'https://api.dataforseo.com/v3';

/** Una llamada a DataForSEO con una sola tarea. Nunca lanza: devuelve ok=false con el motivo. */
export const dfsCall = async (
   method: 'GET' | 'POST', path: string, rawCreds: string, body?: unknown, timeoutMs = 150000,
): Promise<{ ok: boolean, cost: number, task: any, error?: string }> => {
   const creds = parseCredentials(rawCreds);
   if (!creds) { return { ok: false, cost: 0, task: null, error: 'Faltan credenciales de DataForSEO para IA' }; }
   const controller = new AbortController();
   const timer = setTimeout(() => controller.abort(), timeoutMs);
   try {
      const r = await fetch(`${BASE}${path}`, {
         method,
         headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${creds.login}:${creds.password}`).toString('base64')}` },
         body: body ? JSON.stringify(body) : undefined,
         signal: controller.signal,
      });
      const json: any = await r.json();
      const task = json?.tasks?.[0] || null;
      const cost = Number(json?.cost || 0);
      if (json?.status_code !== 20000) { return { ok: false, cost, task, error: `${json?.status_code} ${json?.status_message}` }; }
      return { ok: true, cost, task };
   } catch (e: any) {
      return { ok: false, cost: 0, task: null, error: e?.name === 'AbortError' ? 'Tiempo de espera agotado' : String(e?.message || e) };
   } finally { clearTimeout(timer); }
};
export default dfsCall;
