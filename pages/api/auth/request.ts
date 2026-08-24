import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import User from '../../../database/models/user';
import { isValidEmail, normalizeEmail, requestCode } from '../../../utils/auth/codes';
import { sendLoginCode, smtpConfigured } from '../../../utils/auth/mailer';
import { ensureSuperadmin } from '../../../utils/auth/seed';

type RequestCodeResponse = { success: boolean, message?: string, error?: string | null };

/**
 * POST /api/auth/request { email }
 * Always answers the same neutral message for unknown/inactive emails (no account enumeration).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<RequestCodeResponse>) {
   if (req.method !== 'POST') { return res.status(405).json({ success: false, error: 'Método no permitido' }); }
   const email = normalizeEmail(req.body?.email);
   if (!email || !isValidEmail(email)) { return res.status(400).json({ success: false, error: 'Ingresa un correo válido.' }); }
   if (!process.env.SECRET) { return res.status(500).json({ success: false, error: 'El servidor no tiene SECRET configurado.' }); }

   const neutral = { success: true, message: 'Si el correo está autorizado, te llegará un código de 6 dígitos en unos segundos.' };
   try {
      await db.sync();
      await ensureSuperadmin();
      const user = await User.findOne({ where: { email, active: true } });
      if (!user) { return res.status(200).json(neutral); }
      if (!smtpConfigured()) {
         console.log('[AUTH] SMTP de acceso no configurado; no se puede enviar el código a', email);
         return res.status(500).json({ success: false, error: 'El envío de correos no está configurado. Avisa al administrador.' });
      }
      const result = await requestCode(email, process.env.SECRET);
      if (!result.ok) {
         return res.status(429).json({ success: false, error: 'Demasiados códigos pedidos. Espera una hora e inténtalo de nuevo.' });
      }
      await sendLoginCode(email, result.code);
      return res.status(200).json(neutral);
   } catch (error: any) {
      console.log('[ERROR] auth/request', email, error?.message || error);
      return res.status(500).json({ success: false, error: 'No pudimos enviar el código. Inténtalo de nuevo en un momento.' });
   }
}
