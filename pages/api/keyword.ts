import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../database/database';
import Keyword from '../../database/models/keyword';
import parseKeywords from '../../utils/parseKeywords';
import { authenticate, AuthedRequest } from '../../utils/verifyUser';
import { canAccessDomain } from '../../utils/auth/guards';

type KeywordGetResponse = {
   keyword?: KeywordType | null
   error?: string|null,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const auth = await authenticate(req, res);
   const authorized = auth.authorized ? 'authorized' : auth.error;
   if (authorized === 'authorized' && req.method === 'GET') {
      await db.sync();
      return getKeyword(req, res);
   }
   return res.status(401).json({ error: authorized });
}

const getKeyword = async (req: NextApiRequest, res: NextApiResponse<KeywordGetResponse>) => {
   if (!req.query.id && typeof req.query.id !== 'string') {
       return res.status(400).json({ error: 'Keyword ID is Required!' });
   }

   try {
      const query = { ID: parseInt((req.query.id as string), 10) };
      const foundKeyword:Keyword| null = await Keyword.findOne({ where: query });
      const authed = req as AuthedRequest;
      if (foundKeyword && !authed.authViaApiKey && !canAccessDomain(authed.authUser, foundKeyword.domain)) {
         return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
      }
      const parsedKeyword = foundKeyword && parseKeywords([foundKeyword.get({ plain: true })]);
      const keywords = parsedKeyword && parsedKeyword[0] ? parsedKeyword[0] : null;
      return res.status(200).json({ keyword: keywords });
   } catch (error) {
      console.log('[ERROR] Getting Keyword: ', error);
      return res.status(400).json({ error: 'Error Loading Keyword' });
   }
};
