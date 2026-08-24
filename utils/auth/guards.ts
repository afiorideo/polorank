import type { SessionUser, UserRole } from './types';

/**
 * PoloRank — pure permission helpers (no DB, no HTTP) so they can be unit-tested.
 * The permission matrix lives in docs/specs §6.2.
 */

export const isSuperadmin = (user: SessionUser | null | undefined): boolean => !!user && user.role === 'superadmin';

export const hasRole = (user: SessionUser | null | undefined, roles: UserRole[]): boolean => !!user && roles.includes(user.role);

/** Normalize a domain name for comparison (lowercase, no protocol, no www, no trailing slash). */
export const normalizeDomain = (domain: string | null | undefined): string => {
   if (!domain) { return ''; }
   return domain.trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '');
};

/** SerpBear slug convention: dots → '-', hyphens → '_' (see pages/api/insight.ts). */
export const slugToDomain = (slug: string): string => slug.replaceAll('-', '.').replaceAll('_', '-');

/** Can the user READ this domain (tracking, history, Search Console, ideas)? */
export const canAccessDomain = (user: SessionUser | null | undefined, domain: string | null | undefined): boolean => {
   if (!user) { return false; }
   if (user.role === 'superadmin') { return true; }
   const target = normalizeDomain(domain);
   if (!target) { return false; }
   return normalizeDomain(user.domain) === target || (user.domainSlug || '') === target;
};

/** Can the user add/remove keywords and edit tags on this domain? */
export const canManageKeywords = (user: SessionUser | null | undefined, domain: string | null | undefined): boolean => {
   if (!user) { return false; }
   if (user.role === 'superadmin') { return true; }
   return user.role === 'domain_admin' && canAccessDomain(user, domain);
};

/** Manual position refresh costs money → superadmin only (decision D5). */
export const canRefreshKeywords = (user: SessionUser | null | undefined): boolean => isSuperadmin(user);

/** Domains CRUD, domain settings, global settings, users, usage → superadmin only. */
export const canManageDomains = (user: SessionUser | null | undefined): boolean => isSuperadmin(user);
export const canManageSettings = (user: SessionUser | null | undefined): boolean => isSuperadmin(user);

/** Filter a domain list down to what the user may see. */
export const filterDomainsForUser = <T extends { domain: string, slug?: string }>(user: SessionUser | null | undefined, domains: T[]): T[] => {
   if (!user) { return []; }
   if (user.role === 'superadmin') { return domains; }
   return domains.filter((d) => canAccessDomain(user, d.domain) || (d.slug && d.slug === user.domainSlug));
};
