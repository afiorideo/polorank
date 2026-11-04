import type { NextApiRequest, NextApiResponse } from 'next';
import { Op } from 'sequelize';
import db from '../../../database/database';
import AiPrompt from '../../../database/models/aiPrompt';
import { getAppSettings } from '../settings';
import { authenticate } from '../../../utils/verifyUser';
import AiRun from '../../../database/models/aiRun';
import { canAccessDomain, canRefreshKeywords } from '../../../utils/auth/guards';
import {
   planRun, prepareRun, executeRun, runInFlight, scopeLabelOf, OVERLAP_MIN, RunScope,
} from '../../../utils/aiVisibility/runner';

const COOLDOWN_MIN = 10;

/**
 * GET = estimación de costo · POST = lanza la corrida en vivo. Scopes: prompt (id), domain, google.
 * El POST responde de inmediato (status 'pending') y las consultas siguen en segundo plano: una corrida de dominio
 * son 60 llamadas y Cloudflare corta la petición a los 100 s. Omisiones por tope o credenciales se deciden antes.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const auth = await authenticate(req, res);
   if (!auth.authorized) { return res.status(401).json({ error: auth.error }); }
   if (req.method !== 'GET' && req.method !== 'POST') { return res.status(405).json({ error: 'Método no permitido.' }); }

   const kind = (req.query.scope as string) || '';
   let scope: RunScope;
   let domain = (req.query.domain as string) || '';
   if (kind === 'prompt') {
      const promptId = parseInt((req.query.id as string) || '', 10);
      const prompt = Number.isNaN(promptId) ? null : await AiPrompt.findByPk(promptId);
      if (!prompt || prompt.get('active') === false) { return res.status(404).json({ error: 'Prompt no encontrado.' }); }
      domain = prompt.get('domain') as string;
      scope = { kind: 'prompt', promptId };
   } else if (kind === 'domain' || kind === 'google') {
      if (!domain) { return res.status(400).json({ error: 'Falta indicar el dominio.' }); }
      scope = { kind, domain };
   } else {
      return res.status(400).json({ error: 'Alcance no válido.' });
   }
   if (!canAccessDomain(auth.user, domain)) { return res.status(403).json({ error: 'No tienes acceso a este dominio.' }); }

   try {
      if (req.method === 'GET') {
         const plan = await planRun(scope, 'live');
         return res.status(200).json({ estimate: plan.estimate });
      }
      if (!canRefreshKeywords(auth.user)) { return res.status(403).json({ error: 'Solo el superadmin puede lanzar una corrida.' }); }
      const label = scopeLabelOf(scope);
      const now = new Date();
      const since = new Date(now.getTime() - Math.max(COOLDOWN_MIN, OVERLAP_MIN) * 60000).toJSON();
      const recentRuns = await AiRun.findAll({ where: { scope: label, started_at: { [Op.gte]: since } }, order: [['ID', 'DESC']] });
      const runs = recentRuns.map((r) => ({
         scope: r.get('scope') as string, status: r.get('status') as string, started_at: r.get('started_at') as string,
      }));
      if (runInFlight(runs, label, now)) { return res.status(409).json({ error: 'Ya hay una actualización en curso para este alcance' }); }
      const recent = runs.find((r) => now.getTime() - new Date(r.started_at).getTime() < COOLDOWN_MIN * 60000);
      if (recent) {
         const left = Math.max(1, Math.ceil(COOLDOWN_MIN - (now.getTime() - new Date(recent.started_at).getTime()) / 60000));
         return res.status(429).json({ error: `Espera ${left} minutos antes de volver a actualizar` });
      }
      const settings = await getAppSettings();
      const prep = await prepareRun(scope, 'live', `user:${auth.user?.uid}`, settings);
      if (prep.status === 'pending') {
         // en segundo plano (servidor Node en Docker, no serverless): la respuesta no espera a las IAs
         executeRun(prep).catch(async (e) => {
            console.log('[ERROR] Visibilidad IA corrida en segundo plano: ', e);
            try { await prep.run.update({ status: 'partial', finished_at: new Date().toJSON() }); } catch { /* sin más recurso */ }
         });
      }
      return res.status(200).json({ runId: prep.runId, status: prep.status, estimate: prep.estimate });
   } catch (error) {
      console.log('[ERROR] Visibilidad IA run: ', error);
      return res.status(400).json({ error: 'Error al iniciar la corrida.' });
   }
}
