import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import { authenticate } from '../../../utils/verifyUser';
import { latestRun, runChecks } from '../../../utils/audit/store';
import { CATALOG } from '../../../utils/audit/catalog';

/**
 * PoloRank — every verdict of a domain's latest audit, with its evidence.
 * The catalogue travels with the response so the screen can show each check's title and its explanation
 * without duplicating that text in the frontend: the check definition stays the single source of truth.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const auth = await authenticate(req, res);
   if (!auth.authorized) { return res.status(401).json({ error: auth.error }); }
   if (req.method !== 'GET') { return res.status(405).json({ error: 'Método no permitido.' }); }

   const domain = (req.query.domain as string) || '';
   if (!domain) { return res.status(400).json({ error: 'Falta indicar el dominio.' }); }

   try {
      const run = await latestRun(domain);
      if (!run) { return res.status(200).json({ run: null, checks: [], catalog: [] }); }
      const checks = await runChecks(run.runId);
      const catalog = CATALOG.map((c) => ({ id: c.id, title: c.title, help: c.help, block: c.block, kind: c.kind }));
      return res.status(200).json({ run, checks, catalog });
   } catch (error) {
      console.log('[ERROR] Leyendo el detalle de la auditoría', error);
      return res.status(400).json({ error: 'No se pudo leer el detalle de la auditoría.' });
   }
}
