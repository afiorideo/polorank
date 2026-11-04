import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import AiPrompt from '../../../database/models/aiPrompt';
import { getAppSettings } from '../settings';
import { authenticate } from '../../../utils/verifyUser';
import { canAccessDomain } from '../../../utils/auth/guards';
import { planRun, startRun, RunScope } from '../../../utils/aiVisibility/runner';

/** GET = estimación de costo · POST = lanza la corrida en vivo. Scopes: prompt (id), domain, google. */
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
      if (!prompt) { return res.status(404).json({ error: 'Prompt no encontrado.' }); }
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
      const settings = await getAppSettings();
      const out = await startRun(scope, 'live', `user:${auth.user?.uid}`, settings);
      return res.status(200).json(out);
   } catch (error) {
      console.log('[ERROR] Visibilidad IA run: ', error);
      return res.status(400).json({ error: 'Error al iniciar la corrida.' });
   }
}
