import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import Domain from '../../../database/models/domain';
import { authenticate } from '../../../utils/verifyUser';
import { canAccessDomain } from '../../../utils/auth/guards';
import { parseAiSettings } from '../../../utils/aiVisibility/config';

/** Lee / guarda la configuración de Visibilidad IA del dominio (columna domain.ai_settings). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const auth = await authenticate(req, res);
   if (!auth.authorized) { return res.status(401).json({ error: auth.error }); }
   if (req.method !== 'GET' && req.method !== 'PUT') { return res.status(405).json({ error: 'Método no permitido.' }); }
   const domain = (req.query.domain as string) || '';
   if (!domain) { return res.status(400).json({ error: 'Falta indicar el dominio.' }); }
   if (!canAccessDomain(auth.user, domain)) { return res.status(403).json({ error: 'No tienes acceso a este dominio.' }); }

   try {
      const row = await Domain.findOne({ where: { domain } });
      if (!row) { return res.status(404).json({ error: 'Dominio no encontrado.' }); }
      if (req.method === 'GET') {
         return res.status(200).json({ settings: parseAiSettings(row.get('ai_settings') as string, domain) });
      }
      const settings = parseAiSettings(JSON.stringify(req.body?.settings ?? req.body ?? {}), domain);
      await row.update({ ai_settings: JSON.stringify(settings) });
      return res.status(200).json({ settings });
   } catch (error) {
      console.log('[ERROR] Visibilidad IA config: ', error);
      return res.status(400).json({ error: 'Error al guardar la configuración.' });
   }
}
