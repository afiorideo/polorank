import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../database/database';
import Keyword from '../../database/models/keyword';
import Domain from '../../database/models/domain';
import { getAppSettings } from './settings';
import { authenticate } from '../../utils/verifyUser';
import { isSuperadmin } from '../../utils/auth/guards';
import refreshAndUpdateKeywords from '../../utils/refresh';

type CRONRefreshRes = {
   started: boolean
   error?: string|null,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const auth = await authenticate(req, res);
   const authorized = auth.authorized ? 'authorized' : auth.error;
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }
   if (!auth.viaApiKey && !isSuperadmin(auth.user)) { return res.status(403).json({ error: 'No tienes permiso para esta acción.' }); }
   if (req.method === 'POST') {
      return cronRefreshkeywords(req, res);
   }
   return res.status(502).json({ error: 'Unrecognized Route.' });
}

const cronRefreshkeywords = async (req: NextApiRequest, res: NextApiResponse<CRONRefreshRes>) => {
   try {
      const settings = await getAppSettings();
      if (!settings || (settings && settings.scraper_type === 'never')) {
         return res.status(400).json({ started: false, error: 'Scraper has not been set up yet.' });
      }
      await Keyword.update({ updating: true }, { where: {} });
      const keywordQueries: Keyword[] = await Keyword.findAll();
      const allDomains: Domain[] = await Domain.findAll();
      const domainList: DomainType[] = allDomains.map((d) => d.get({ plain: true }));

      refreshAndUpdateKeywords(keywordQueries, settings, domainList);

      return res.status(200).json({ started: true });
   } catch (error) {
      console.log('[ERROR] CRON Refreshing Keywords: ', error);
      return res.status(400).json({ started: false, error: 'CRON Error refreshing keywords!' });
   }
};
