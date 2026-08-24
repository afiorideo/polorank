import nodeMailer from 'nodemailer';
import { loginCodeEmail } from './emailTemplate';

export { loginCodeEmail } from './emailTemplate';

/**
 * PoloRank — sends the 6-digit access code. SMTP comes from env (SMTP_HOST/PORT/USER/PASS/FROM),
 * independent from the notification SMTP configured in Settings.
 */
/** Host is required; credentials are optional (a relay without AUTH, e.g. a local test server, works with SMTP_USER empty). */
export const smtpConfigured = (): boolean => !!process.env.SMTP_HOST && (!process.env.SMTP_USER || !!process.env.SMTP_PASS);

const buildTransport = () => {
   const port = parseInt(process.env.SMTP_PORT || '587', 10);
   return nodeMailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } } : {}),
   });
};

export const sendLoginCode = async (to: string, code: string): Promise<void> => {
   if (!smtpConfigured()) { throw new Error('SMTP de acceso no configurado (SMTP_HOST y, si hay usuario, SMTP_PASS)'); }
   const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
   const from = process.env.SMTP_FROM || `PoloRank <${process.env.SMTP_USER}>`;
   const { subject, text, html } = loginCodeEmail(code, appUrl);
   await buildTransport().sendMail({ from, to, subject, text, html });
};
