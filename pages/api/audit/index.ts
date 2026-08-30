import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import Domain from '../../../database/models/domain';
import { authenticate } from '../../../utils/verifyUser';
import { isSuperadmin } from '../../../utils/auth/guards';
import { latestRunPerDomain } from '../../../utils/audit/store';
import { auditDomain } from '../../../utils/audit/run';

/**
 * PoloRank — audit API.
 * GET  reads the latest run of every domain (the portfolio screen).
 * POST launches an audit. Restricted the same way refreshing positions is: it consumes resources and, unlike a
 *      read, it goes out and hits a client's server.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const auth = await authenticate(req, res);
   if (!auth.authorized) { return res.status(401).json({ error: auth.error }); }

   if (req.method === 'GET') {
      try {
         const rows: Domain[] = await Domain.findAll();
         const domains = rows.map((d) => d.get('domain') as string);
         const runs = await latestRunPerDomain(domains);
         return res.status(200).json({ runs });
      } catch (error) {
         console.log('[ERROR] Leyendo auditorías', error);
         return res.status(400).json({ error: 'No se pudieron leer las auditorías.' });
      }
   }

   if (req.method === 'POST') {
      if (!auth.viaApiKey && !isSuperadmin(auth.user)) {
         return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
      }
      const { domain } = req.body || {};
      if (!domain) { return res.status(400).json({ error: 'Falta indicar el dominio.' }); }
      const domainRow = await Domain.findOne({ where: { domain } });
      if (!domainRow) { return res.status(404).json({ error: 'Dominio no encontrado.' }); }

      const triggeredBy = auth.viaApiKey ? 'cron' : `user:${auth.user?.uid || ''}`;
      const outcome = await auditDomain(domainRow, triggeredBy);
      if (!outcome.ok) { return res.status(409).json({ error: outcome.error }); }
      return res.status(200).json({ runId: outcome.runId });
   }

   return res.status(405).json({ error: 'Método no permitido.' });
}
