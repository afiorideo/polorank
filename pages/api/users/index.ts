import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import Domain from '../../../database/models/domain';
import User from '../../../database/models/user';
import { isValidEmail, normalizeEmail } from '../../../utils/auth/codes';
import { isSuperadmin } from '../../../utils/auth/guards';
import { ensureSuperadmin, isSeededSuperadmin } from '../../../utils/auth/seed';
import { ROLES, UserRole } from '../../../utils/auth/types';
import { authenticate } from '../../../utils/verifyUser';

export type UserListItem = {
   ID: number,
   email: string,
   role: UserRole,
   domain_id: number | null,
   domain: string | null,
   active: boolean,
   created_at: string,
   last_login: string | null,
   /** The ADMIN_EMAIL superadmin: cannot be edited/deleted from the UI */
   locked: boolean,
};

type UsersResponse = { users?: UserListItem[], user?: UserListItem, error?: string | null };

export const toListItem = (u: User, domains: Domain[]): UserListItem => {
   const dom = u.domain_id ? domains.find((d) => d.ID === u.domain_id) : undefined;
   return {
      ID: u.ID,
      email: u.email,
      role: u.role as UserRole,
      domain_id: u.domain_id,
      domain: dom ? dom.domain : null,
      active: !!u.active,
      created_at: u.created_at,
      last_login: u.last_login,
      locked: isSeededSuperadmin(u.email),
   };
};

/** Validates role/domain combination. Returns an error message or null. */
export const validateRoleAndDomain = (role: string, domainId: number | null, domains: Domain[]): string | null => {
   if (!ROLES.includes(role as UserRole)) { return 'Rol inválido.'; }
   if (role === 'superadmin') { return null; }
   if (!domainId) { return 'Los administradores y usuarios de dominio necesitan un dominio asignado.'; }
   if (!domains.find((d) => d.ID === domainId)) { return 'El dominio asignado no existe.'; }
   return null;
};

/** GET /api/users (list) · POST /api/users { email, role, domain_id } — superadmin only. */
export default async function handler(req: NextApiRequest, res: NextApiResponse<UsersResponse>) {
   await db.sync();
   const auth = await authenticate(req, res);
   if (!auth.authorized) { return res.status(401).json({ error: auth.error }); }
   if (!isSuperadmin(auth.user)) { return res.status(403).json({ error: 'Solo el administrador total puede gestionar usuarios.' }); }

   if (req.method === 'GET') {
      await ensureSuperadmin();
      const [users, domains] = await Promise.all([User.findAll({ order: [['ID', 'ASC']] }), Domain.findAll()]);
      return res.status(200).json({ users: users.map((u) => toListItem(u, domains)) });
   }

   if (req.method === 'POST') {
      const email = normalizeEmail(req.body?.email);
      const role = String(req.body?.role || '');
      const domainId = role === 'superadmin' ? null : (parseInt(req.body?.domain_id, 10) || null);
      if (!email || !isValidEmail(email)) { return res.status(400).json({ error: 'Ingresa un correo válido.' }); }
      const domains = await Domain.findAll();
      const validation = validateRoleAndDomain(role, domainId, domains);
      if (validation) { return res.status(400).json({ error: validation }); }
      const existing = await User.findOne({ where: { email } });
      if (existing) { return res.status(409).json({ error: 'Ese correo ya está registrado.' }); }
      try {
         const created = await User.create({ email, role, domain_id: domainId, active: true, created_at: new Date().toJSON(), last_login: null });
         return res.status(201).json({ user: toListItem(created, domains) });
      } catch (error: any) {
         console.log('[ERROR] creando usuario', email, error?.message || error);
         return res.status(500).json({ error: 'No se pudo crear el usuario.' });
      }
   }

   return res.status(405).json({ error: 'Método no permitido' });
}
