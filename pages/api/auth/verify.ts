import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import Domain from '../../../database/models/domain';
import User from '../../../database/models/user';
import { isValidCodeFormat, normalizeEmail, verifyCode } from '../../../utils/auth/codes';
import { setSessionCookie, signSession } from '../../../utils/auth/session';
import type { UserRole } from '../../../utils/auth/types';

type VerifyResponse = { success: boolean, redirect?: string, error?: string | null };

const MESSAGES: { [k: string]: string } = {
   no_code: 'No hay un código vigente para este correo. Pide uno nuevo.',
   expired: 'El código venció. Pide uno nuevo.',
   too_many_attempts: 'Demasiados intentos. Pide un código nuevo.',
   wrong_code: 'Código incorrecto.',
};

/** POST /api/auth/verify { email, code } → sets the session cookie. */
export default async function handler(req: NextApiRequest, res: NextApiResponse<VerifyResponse>) {
   if (req.method !== 'POST') { return res.status(405).json({ success: false, error: 'Método no permitido' }); }
   const email = normalizeEmail(req.body?.email);
   const code = String(req.body?.code || '').trim();
   if (!email || !isValidCodeFormat(code)) { return res.status(400).json({ success: false, error: 'Ingresa el código de 6 dígitos.' }); }
   if (!process.env.SECRET) { return res.status(500).json({ success: false, error: 'El servidor no tiene SECRET configurado.' }); }

   try {
      await db.sync();
      const user = await User.findOne({ where: { email, active: true } });
      // Same message as a wrong code: never reveal whether the email exists.
      if (!user) { return res.status(401).json({ success: false, error: MESSAGES.wrong_code }); }

      const result = await verifyCode(email, code, process.env.SECRET);
      if (result !== 'ok') { return res.status(401).json({ success: false, error: MESSAGES[result] }); }

      const role = user.role as UserRole;
      let redirect = '/domains';
      if (role !== 'superadmin') {
         const dom = user.domain_id ? await Domain.findByPk(user.domain_id) : null;
         if (!dom) { return res.status(403).json({ success: false, error: 'Tu usuario no tiene un dominio asignado. Avisa al administrador.' }); }
         redirect = `/domain/${dom.slug}`;
      }
      const token = signSession({ uid: user.ID, email: user.email, role, domainId: role === 'superadmin' ? null : user.domain_id });
      setSessionCookie(req, res, token);
      await user.update({ last_login: new Date().toJSON() });
      return res.status(200).json({ success: true, redirect, error: null });
   } catch (error: any) {
      console.log('[ERROR] auth/verify', email, error?.message || error);
      return res.status(500).json({ success: false, error: 'No pudimos validar el código. Inténtalo de nuevo.' });
   }
}
