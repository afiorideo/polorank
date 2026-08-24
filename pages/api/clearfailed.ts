import { writeFile } from 'fs/promises';
import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '../../utils/verifyUser';
import { isSuperadmin } from '../../utils/auth/guards';

type SettingsGetResponse = {
   cleared?: boolean,
   error?: string,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const auth = await authenticate(req, res);
   const authorized = auth.authorized ? 'authorized' : auth.error;
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }
   if (!isSuperadmin(auth.user)) { return res.status(403).json({ error: 'No tienes permiso para esta acción.' }); }
   if (req.method === 'PUT') {
      return clearFailedQueue(req, res);
   }
   return res.status(502).json({ error: 'Unrecognized Route.' });
}

const clearFailedQueue = async (req: NextApiRequest, res: NextApiResponse<SettingsGetResponse>) => {
   try {
      await writeFile(`${process.cwd()}/data/failed_queue.json`, JSON.stringify([]), { encoding: 'utf-8' });
      return res.status(200).json({ cleared: true });
   } catch (error) {
      console.log('[ERROR] Clearing Failed Queue File.', error);
      return res.status(200).json({ error: 'Error Clearing Failed Queue!' });
   }
};
