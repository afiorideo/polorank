import type { GetServerSidePropsContext, GetServerSidePropsResult } from 'next';
import { readSessionToken, verifySessionToken } from './session';
import type { SessionUser, UserRole } from './types';

/**
 * PoloRank — server-side page guard (getServerSideProps helper).
 *  - no session → /login
 *  - domain-scoped users → only their own domain pages; anything else redirects to /domain/<slug>
 *  - `superadminOnly` pages (research, etc.) → domain users are redirected to their domain
 */
type GuardOptions = { superadminOnly?: boolean, slugParam?: string };

const redirect = (destination: string): GetServerSidePropsResult<{}> => ({ redirect: { destination, permanent: false } });

export const getPageUser = async (ctx: GetServerSidePropsContext): Promise<SessionUser | null> => {
   const payload = verifySessionToken(readSessionToken(ctx.req, ctx.res));
   if (!payload) { return null; }
   // Loaded lazily: keeps page modules free of native DB deps (sqlite3) for the client bundle and jsdom tests
   const [{ default: db }, { default: User }, { default: Domain }] = await Promise.all([
      import('../../database/database'), import('../../database/models/user'), import('../../database/models/domain'),
   ]);
   await db.sync();
   const record = await User.findByPk(payload.uid);
   if (!record || !record.active) { return null; }
   const role = record.role as UserRole;
   if (role === 'superadmin') {
      return { uid: record.ID, email: record.email, role, domainId: null, domain: null, domainSlug: null };
   }
   if (!record.domain_id) { return null; }
   const dom = await Domain.findByPk(record.domain_id);
   if (!dom) { return null; }
   return { uid: record.ID, email: record.email, role, domainId: record.domain_id, domain: dom.domain, domainSlug: dom.slug };
};

export const guardPage = async (ctx: GetServerSidePropsContext, options: GuardOptions = {}): Promise<GetServerSidePropsResult<{}>> => {
   const user = await getPageUser(ctx);
   if (!user) { return redirect('/login'); }
   if (user.role === 'superadmin') { return { props: {} }; }
   const home = `/domain/${user.domainSlug}`;
   if (options.superadminOnly) { return redirect(home); }
   if (options.slugParam) {
      const slug = ctx.params ? ctx.params[options.slugParam] : undefined;
      if (typeof slug === 'string' && slug !== user.domainSlug) { return redirect(home); }
   }
   return { props: {} };
};

/** For /login: send already-authenticated users to their home. */
export const redirectIfAuthenticated = async (ctx: GetServerSidePropsContext): Promise<GetServerSidePropsResult<{}>> => {
   const user = await getPageUser(ctx);
   if (!user) { return { props: {} }; }
   return redirect(user.role === 'superadmin' ? '/domains' : `/domain/${user.domainSlug}`);
};
