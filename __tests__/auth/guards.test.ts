import {
   canAccessDomain, canManageDomains, canManageKeywords, canManageSettings, canRefreshKeywords, filterDomainsForUser, normalizeDomain, slugToDomain,
} from '../../utils/auth/guards';
import type { SessionUser } from '../../utils/auth/types';

const superadmin: SessionUser = { uid: 1, email: 'afiorid@gmail.com', role: 'superadmin', domainId: null, domain: null, domainSlug: null };
const ammoAdmin: SessionUser = { uid: 2, email: 'admin@ammo.cl', role: 'domain_admin', domainId: 10, domain: 'ammo.cl', domainSlug: 'ammo-cl' };
const ammoUser: SessionUser = { uid: 3, email: 'ver@ammo.cl', role: 'domain_user', domainId: 10, domain: 'ammo.cl', domainSlug: 'ammo-cl' };

describe('guardas de permisos (PoloRank)', () => {
   it('normalizeDomain limpia protocolo, www y barra final', () => {
      expect(normalizeDomain('https://www.Ammo.cl/')).toBe('ammo.cl');
      expect(normalizeDomain(undefined)).toBe('');
   });

   it('slugToDomain sigue la convención de SerpBear', () => {
      expect(slugToDomain('ammo-cl')).toBe('ammo.cl');
      expect(slugToDomain('mi_sitio-com')).toBe('mi-sitio.com');
   });

   it('superadmin accede y administra todo', () => {
      expect(canAccessDomain(superadmin, 'ammo.cl')).toBe(true);
      expect(canAccessDomain(superadmin, 'otro.cl')).toBe(true);
      expect(canManageKeywords(superadmin, 'otro.cl')).toBe(true);
      expect(canRefreshKeywords(superadmin)).toBe(true);
      expect(canManageDomains(superadmin)).toBe(true);
      expect(canManageSettings(superadmin)).toBe(true);
   });

   it('administrador de dominio: ve y gestiona keywords SOLO de su dominio, no refresca ni configura', () => {
      expect(canAccessDomain(ammoAdmin, 'ammo.cl')).toBe(true);
      expect(canAccessDomain(ammoAdmin, 'www.ammo.cl')).toBe(true);
      expect(canAccessDomain(ammoAdmin, 'ammo-cl')).toBe(true);
      expect(canAccessDomain(ammoAdmin, 'mavae.cl')).toBe(false);
      expect(canManageKeywords(ammoAdmin, 'ammo.cl')).toBe(true);
      expect(canManageKeywords(ammoAdmin, 'mavae.cl')).toBe(false);
      expect(canRefreshKeywords(ammoAdmin)).toBe(false);
      expect(canManageDomains(ammoAdmin)).toBe(false);
      expect(canManageSettings(ammoAdmin)).toBe(false);
   });

   it('usuario de dominio: solo mira su dominio', () => {
      expect(canAccessDomain(ammoUser, 'ammo.cl')).toBe(true);
      expect(canAccessDomain(ammoUser, 'mavae.cl')).toBe(false);
      expect(canManageKeywords(ammoUser, 'ammo.cl')).toBe(false);
      expect(canRefreshKeywords(ammoUser)).toBe(false);
   });

   it('sin sesión no se puede nada', () => {
      expect(canAccessDomain(null, 'ammo.cl')).toBe(false);
      expect(canManageKeywords(undefined, 'ammo.cl')).toBe(false);
      expect(canRefreshKeywords(null)).toBe(false);
   });

   it('filterDomainsForUser deja solo lo permitido', () => {
      const domains = [{ domain: 'ammo.cl', slug: 'ammo-cl' }, { domain: 'mavae.cl', slug: 'mavae-cl' }];
      expect(filterDomainsForUser(superadmin, domains)).toHaveLength(2);
      expect(filterDomainsForUser(ammoUser, domains).map((d) => d.domain)).toEqual(['ammo.cl']);
      expect(filterDomainsForUser(null, domains)).toEqual([]);
   });
});
