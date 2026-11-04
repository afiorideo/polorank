import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import { getAppSettings } from '../settings';
import { authenticate } from '../../../utils/verifyUser';
import { isSuperadmin } from '../../../utils/auth/guards';
import { collectPending } from '../../../utils/aiVisibility/runner';

/** Recolecta las respuestas pendientes de la cola de DataForSEO (la dispara cron.js cada 10 min). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const auth = await authenticate(req, res);
   if (!auth.authorized) { return res.status(401).json({ error: auth.error }); }
   if (!auth.viaApiKey && !isSuperadmin(auth.user)) { return res.status(403).json({ error: 'No tienes permiso para esta acción.' }); }
   if (req.method !== 'POST') { return res.status(405).json({ error: 'Método no permitido.' }); }
   try {
      const settings = await getAppSettings();
      return res.status(200).json(await collectPending(settings));
   } catch (error) {
      console.log('[ERROR] Visibilidad IA collect: ', error);
      return res.status(400).json({ error: 'Error al recolectar respuestas.' });
   }
}
