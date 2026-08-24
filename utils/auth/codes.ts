import { Op } from 'sequelize';
import LoginCode from '../../database/models/loginCode';
import { CODE_TTL_MINUTES, MAX_ATTEMPTS, MAX_CODES_PER_HOUR, generateCode, hashCode } from './codeUtils';

export * from './codeUtils';

export type RequestCodeResult = { ok: true, code: string } | { ok: false, reason: 'rate_limited' };

/**
 * Creates a new login code for the email (invalidating older unused ones) unless the hourly limit was reached.
 * Returns the plain code ONLY so the caller can email it — it is never persisted.
 */
export const requestCode = async (email: string, secret: string): Promise<RequestCodeResult> => {
   const now = new Date();
   const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toJSON();
   const recent = await LoginCode.count({ where: { email, created_at: { [Op.gt]: oneHourAgo } } });
   if (recent >= MAX_CODES_PER_HOUR) { return { ok: false, reason: 'rate_limited' }; }

   await LoginCode.update({ used: true }, { where: { email, used: false } });
   const code = generateCode();
   await LoginCode.create({
      email,
      code_hash: hashCode(email, code, secret),
      expires_at: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000).toJSON(),
      attempts: 0,
      used: false,
      created_at: now.toJSON(),
   });
   return { ok: true, code };
};

export type VerifyCodeResult = 'ok' | 'no_code' | 'expired' | 'too_many_attempts' | 'wrong_code';

/** Validates a code against the latest unused one for the email; consumes it on success. */
export const verifyCode = async (email: string, code: string, secret: string): Promise<VerifyCodeResult> => {
   const record = await LoginCode.findOne({ where: { email, used: false }, order: [['ID', 'DESC']] });
   if (!record) { return 'no_code'; }
   if (new Date(record.expires_at).getTime() < Date.now()) {
      await record.update({ used: true });
      return 'expired';
   }
   if (record.attempts >= MAX_ATTEMPTS) {
      await record.update({ used: true });
      return 'too_many_attempts';
   }
   if (record.code_hash !== hashCode(email, code.trim(), secret)) {
      const attempts = record.attempts + 1;
      await record.update({ attempts, used: attempts >= MAX_ATTEMPTS });
      return attempts >= MAX_ATTEMPTS ? 'too_many_attempts' : 'wrong_code';
   }
   await record.update({ used: true });
   return 'ok';
};

/** Housekeeping: drop expired/used codes older than a day (called from the daily cron). */
export const purgeOldCodes = async (): Promise<number> => {
   const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toJSON();
   return LoginCode.destroy({ where: { created_at: { [Op.lt]: dayAgo } } });
};
