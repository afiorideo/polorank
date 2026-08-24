import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import Domain from '../../../database/models/domain';
import User from '../../../database/models/user';
import { isSuperadmin } from '../../../utils/auth/guards';
import { isSeededSuperadmin } from '../../../utils/auth/seed';
import { authenticate } from '../../../utils/verifyUser';
import { toListItem, validateRoleAndDomain, UserListItem } from './index';

type UserResponse = { user?: UserListItem, success?: boolean, error?: string | null };

/** PUT /api/users/[id] { role?, domain_id?, active? } · DELETE /api/users/[id] — superadmin only. */
export default async function handler(req: NextApiRequest, res: NextApiResponse<UserResponse>) {
   await db.sync();
   const auth = await authenticate(req, res);
   if (!auth.authorized) { return res.status(401).json({ error: auth.error }); }
   if (!isSuperadmin(auth.user)) { return res.status(403).json({ error: 'Solo el administrador total puede gestionar usuarios.' }); }

   const id = parseInt(String(req.query.id), 10);
   if (!id) { return res.status(400).json({ error: 'ID inválido.' }); }
   const target = await User.findByPk(id);
   if (!target) { return res.status(404).json({ error: 'Usuario no encontrado.' }); }
   if (isSeededSuperadmin(target.email)) { return res.status(403).json({ error: 'El administrador principal no se puede modificar ni eliminar.' }); }
   if (auth.user && target.ID === auth.user.uid) { return res.status(403).json({ error: 'No puedes modificar tu propio usuario desde acá.' }); }

   if (req.method === 'PUT') {
      const domains = await Domain.findAll();
      const role = typeof req.body?.role === 'string' ? req.body.role : target.role;
      const rawDomain = req.body?.domain_id !== undefined ? req.body.domain_id : target.domain_id;
      const domainId = role === 'superadmin' ? null : (parseInt(rawDomain, 10) || null);
      const validation = validateRoleAndDomain(role, domainId, domains);
      if (validation) { return res.status(400).json({ error: validation }); }
      const active = typeof req.body?.active === 'boolean' ? req.body.active : !!target.active;
      await target.update({ role, domain_id: domainId, active });
      return res.status(200).json({ user: toListItem(target, domains) });
   }

   if (req.method === 'DELETE') {
      await target.destroy();
      return res.status(200).json({ success: true });
   }

   return res.status(405).json({ error: 'Método no permitido' });
}
