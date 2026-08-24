export type UserRole = 'superadmin' | 'domain_admin' | 'domain_user';

export const ROLES: UserRole[] = ['superadmin', 'domain_admin', 'domain_user'];

/** What a request knows about the caller after authentication. */
export type SessionUser = {
   uid: number,
   email: string,
   role: UserRole,
   domainId: number | null,
   /** Domain name (e.g. ammo.cl) for domain-scoped roles; null for superadmin */
   domain: string | null,
   /** Domain slug (e.g. ammo-cl) for domain-scoped roles; null for superadmin */
   domainSlug: string | null,
};

/** Shape returned to the browser by GET /api/auth/me */
export type AuthUserResponse = {
   user: SessionUser | null,
   error?: string | null,
};

/** JWT payload stored in the session cookie. `v: 2` distinguishes PoloRank sessions from legacy SerpBear tokens. */
export type SessionPayload = {
   v: 2,
   uid: number,
   email: string,
   role: UserRole,
   domainId: number | null,
};
