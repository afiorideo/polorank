import { createHash, randomInt } from 'crypto';

/**
 * PoloRank — pure helpers for the email access codes (no DB) so they can be unit-tested in jsdom.
 */
export const CODE_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
export const MAX_CODES_PER_HOUR = 5;

/** Six random digits, zero-padded, from a CSPRNG. */
export const generateCode = (): string => String(randomInt(0, 1000000)).padStart(6, '0');

/** SHA-256 of email + code + app secret. The code itself is never stored. */
export const hashCode = (email: string, code: string, secret: string): string => createHash('sha256')
   .update(`${email.trim().toLowerCase()}:${code}:${secret}`)
   .digest('hex');

export const normalizeEmail = (email: string | undefined | null): string => (email || '').trim().toLowerCase();

export const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const isValidCodeFormat = (code: string | undefined | null): boolean => /^\d{6}$/.test((code || '').trim());
