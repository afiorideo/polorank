import type { NextApiRequest, NextApiResponse } from 'next';
// Side-effect import: registers every model in the Sequelize instance before any handler touches User/Domain
import '../database/database';
import Domain from '../database/models/domain';
import User from '../database/models/user';
import { readSessionToken, verifySessionToken } from './auth/session';
import type { SessionUser, UserRole } from './auth/types';

/**
 * PoloRank — request authentication.
 *
 * Two ways in:
 *  1. Session cookie (JWT v2) issued by /api/auth/verify → a real user with a role.
 *  2. `Authorization: Bearer <APIKEY>` → the internal cron, limited to `allowedApiRoutes` (SerpBear behaviour).
 */

/** Request enriched by authenticate(): handlers read req.authUser / req.authViaApiKey */
export type AuthedRequest = NextApiRequest & { authUser?: SessionUser | null, authViaApiKey?: boolean };

export type AuthResult = {
   authorized: boolean,
   /** Human readable reason when not authorized (kept compatible with SerpBear's messages). */
   error: string,
   /** The authenticated user, or null for API-key calls. */
   user: SessionUser | null,
   viaApiKey: boolean,
};

const allowedApiRoutes = [
   'GET:/api/keyword',
   'GET:/api/keywords',
   'GET:/api/domains',
   'POST:/api/refresh',
   'POST:/api/cron',
   'POST:/api/notify',
   'POST:/api/searchconsole',
   'GET:/api/searchconsole',
   'GET:/api/insight',
   'POST:/api/audit',
   'POST:/api/audit/cron',
];

const loadSessionUser = async (uid: number): Promise<SessionUser | null> => {
   const record = await User.findByPk(uid);
   if (!record || !record.active) { return null; }
   const role = record.role as UserRole;
   let domain: string | null = null;
   let domainSlug: string | null = null;
   if (role !== 'superadmin') {
      if (!record.domain_id) { return null; }
      const dom = await Domain.findByPk(record.domain_id);
      if (!dom) { return null; }
      domain = dom.domain;
      domainSlug = dom.slug;
   }
   return { uid: record.ID, email: record.email, role, domainId: role === 'superadmin' ? null : record.domain_id, domain, domainSlug };
};

/** Authenticate an API request. Reads the cookie session (and re-validates the user in DB) or the API key. */
export const authenticate = async (req: NextApiRequest, res: NextApiResponse): Promise<AuthResult> => {
   const result = await authenticateRequest(req, res);
   (req as AuthedRequest).authUser = result.user;
   (req as AuthedRequest).authViaApiKey = result.viaApiKey;
   return result;
};

const authenticateRequest = async (req: NextApiRequest, res: NextApiResponse): Promise<AuthResult> => {
   const token = readSessionToken(req, res);
   const payload = verifySessionToken(token);
   if (payload) {
      const user = await loadSessionUser(payload.uid);
      if (user) { return { authorized: true, error: '', user, viaApiKey: false }; }
      return { authorized: false, error: 'Not authorized', user: null, viaApiKey: false };
   }

   const bearer = req.headers.authorization ? req.headers.authorization.substring('Bearer '.length) : '';
   const verifiedAPI = !!bearer && !!process.env.APIKEY && bearer === process.env.APIKEY;
   const route = req.url && req.method ? `${req.method}:${req.url.replace(/\?(.*)/, '')}` : '';
   const accessingAllowedRoute = allowedApiRoutes.includes(route);

   if (verifiedAPI && accessingAllowedRoute) { return { authorized: true, error: '', user: null, viaApiKey: true }; }
   if (verifiedAPI && !accessingAllowedRoute) {
      return { authorized: false, error: 'This Route cannot be accessed with API.', user: null, viaApiKey: true };
   }
   if (req.headers.authorization && !verifiedAPI) { return { authorized: false, error: 'Invalid API Key Provided.', user: null, viaApiKey: false }; }
   if (token && !process.env.SECRET) { return { authorized: false, error: 'Token has not been Setup.', user: null, viaApiKey: false }; }
   return { authorized: false, error: 'Not authorized', user: null, viaApiKey: false };
};

/**
 * Legacy SerpBear signature kept for handlers not yet migrated: returns 'authorized' or an error string.
 * Note: it is async now — callers must `await` it.
 */
const verifyUser = async (req: NextApiRequest, res: NextApiResponse): Promise<string> => {
   const result = await authenticate(req, res);
   return result.authorized ? 'authorized' : result.error;
};

export default verifyUser;
