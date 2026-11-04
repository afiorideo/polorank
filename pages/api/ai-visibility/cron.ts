import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import { getAppSettings } from '../settings';
import { authenticate } from '../../../utils/verifyUser';
import { isSuperadmin } from '../../../utils/auth/guards';
import { startRun } from '../../../utils/aiVisibility/runner';

/** Corrida semanal de Visibilidad IA (la dispara cron.js los lunes 09:00 UTC). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const auth = await authenticate(req, res);
   if (!auth.authorized) { return res.status(401).json({ error: auth.error }); }
   if (!auth.viaApiKey && !isSuperadmin(auth.user)) { return res.status(403).json({ error: 'No tienes permiso para esta acción.' }); }
   if (req.method !== 'POST') { return res.status(405).json({ error: 'Método no permitido.' }); }
   try {
      const settings = await getAppSettings();
      if (settings.ai_weekly_enabled === false) { return res.status(200).json({ started: false, reason: 'weekly_disabled' }); }
      const out = await startRun({ kind: 'all' }, 'queue', 'cron', settings);
      return res.status(200).json({ started: true, ...out });
   } catch (error) {
      console.log('[ERROR] Visibilidad IA cron: ', error);
      return res.status(400).json({ started: false, error: 'Error al iniciar la corrida semanal.' });
   }
}
