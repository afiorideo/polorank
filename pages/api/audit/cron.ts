import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import Domain from '../../../database/models/domain';
import Keyword from '../../../database/models/keyword';
import { authenticate } from '../../../utils/verifyUser';
import { auditDomain } from '../../../utils/audit/run';
import { sleep } from '../../../utils/audit/sleep';

/** A domain audit visits a client's server. Between them there is a pause, so no site is hammered. */
const PAUSE_BETWEEN_DOMAINS_MS = 5000;

/**
 * PoloRank — the weekly audit of every domain, one at a time.
 *
 * It refuses to start while a position scrape is running. That is the third lock of the module (the other two
 * are the `running` row per domain and the crawler's own limits) and it exists for one reason: the position
 * tracking is the job this server cannot afford to lose, and it always wins the tie.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const auth = await authenticate(req, res);
   if (!auth.authorized) { return res.status(401).json({ error: auth.error }); }
   if (req.method !== 'POST') { return res.status(405).json({ error: 'Método no permitido.' }); }

   const scraping = await Keyword.count({ where: { updating: true } });
   if (scraping > 0) {
      console.log('[AUDITORÍA] Postergada: hay un scrape de posiciones en curso');
      return res.status(200).json({ skipped: true, reason: 'Hay un scrape de posiciones en curso' });
   }

   const rows: Domain[] = await Domain.findAll();
   const results: { domain: string, ok: boolean, error?: string }[] = [];

   for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const domain = row.get('domain') as string;
      // eslint-disable-next-line no-await-in-loop
      const outcome = await auditDomain(row, 'cron');
      results.push({ domain, ok: outcome.ok, error: outcome.error });
      console.log(`[AUDITORÍA] ${domain}: ${outcome.ok ? 'ok' : `falló (${outcome.error})`}`);
      // no pausa después del último: no queda nadie a quien cuidar
      // eslint-disable-next-line no-await-in-loop
      if (i < rows.length - 1) { await sleep(PAUSE_BETWEEN_DOMAINS_MS); }
   }

   return res.status(200).json({ audited: results.length, results });
}
