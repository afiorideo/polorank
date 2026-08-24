import type { IncomingMessage, ServerResponse } from 'http';
import jwt from 'jsonwebtoken';
import Cookies from 'cookies';
import type { SessionPayload, SessionUser } from './types';

export const SESSION_COOKIE = 'token';

const sessionHours = (): number => {
   const raw = process.env.SESSION_DURATION;
   const hours = raw ? parseInt(raw, 10) : 0;
   return Number.isFinite(hours) && hours > 0 ? hours : 24;
};

export const signSession = (user: Pick<SessionUser, 'uid' | 'email' | 'role' | 'domainId'>): string => {
   if (!process.env.SECRET) { throw new Error('SECRET no configurado'); }
   const payload: SessionPayload = { v: 2, uid: user.uid, email: user.email, role: user.role, domainId: user.domainId };
   return jwt.sign(payload, process.env.SECRET, { expiresIn: `${sessionHours()}h` });
};

export const readSessionToken = (req: IncomingMessage, res: ServerResponse): string | undefined => {
   const cookies = new Cookies(req, res);
   return cookies.get(SESSION_COOKIE);
};

/** Returns the payload when the token is a valid PoloRank (v2) session; null otherwise. */
export const verifySessionToken = (token: string | undefined): SessionPayload | null => {
   if (!token || !process.env.SECRET) { return null; }
   try {
      const decoded = jwt.verify(token, process.env.SECRET) as Partial<SessionPayload>;
      if (!decoded || decoded.v !== 2 || typeof decoded.uid !== 'number' || !decoded.email || !decoded.role) { return null; }
      return decoded as SessionPayload;
   } catch (error) {
      return null;
   }
};

export const setSessionCookie = (req: IncomingMessage, res: ServerResponse, token: string): void => {
   const cookies = new Cookies(req, res);
   const maxAge = sessionHours() * 60 * 60 * 1000;
   cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge, overwrite: true });
};

export const clearSessionCookie = (req: IncomingMessage, res: ServerResponse): void => {
   const cookies = new Cookies(req, res);
   cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, overwrite: true });
};
