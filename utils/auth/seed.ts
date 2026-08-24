import User from '../../database/models/user';
import { normalizeEmail, isValidEmail } from './codes';

/**
 * PoloRank — guarantees the ADMIN_EMAIL superadmin exists and is active.
 * Safe to call on every auth request (one indexed lookup).
 */
export const ensureSuperadmin = async (): Promise<void> => {
   const email = normalizeEmail(process.env.ADMIN_EMAIL);
   if (!email || !isValidEmail(email)) { return; }
   const existing = await User.findOne({ where: { email } });
   if (!existing) {
      await User.create({ email, role: 'superadmin', domain_id: null, active: true, created_at: new Date().toJSON(), last_login: null });
      console.log('[AUTH] Superadmin sembrado:', email);
      return;
   }
   if (existing.role !== 'superadmin' || !existing.active) {
      await existing.update({ role: 'superadmin', domain_id: null, active: true });
   }
};

export const isSeededSuperadmin = (email: string): boolean => normalizeEmail(email) === normalizeEmail(process.env.ADMIN_EMAIL);

export default ensureSuperadmin;
