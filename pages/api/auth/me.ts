import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import { authenticate } from '../../../utils/verifyUser';
import type { AuthUserResponse } from '../../../utils/auth/types';

/** GET /api/auth/me → the current user (role + domain) so the UI can show/hide actions. */
export default async function handler(req: NextApiRequest, res: NextApiResponse<AuthUserResponse>) {
   if (req.method !== 'GET') { return res.status(405).json({ user: null, error: 'Método no permitido' }); }
   await db.sync();
   const auth = await authenticate(req, res);
   if (!auth.authorized || !auth.user) { return res.status(401).json({ user: null, error: auth.error || 'Not authorized' }); }
   return res.status(200).json({ user: auth.user, error: null });
}
