import React, { useMemo, useState } from 'react';
import type { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { CSSTransition } from 'react-transition-group';
import { guardPage } from '../../../utils/auth/pageGuard';
import { useAuthUser } from '../../../services/auth';
import TopBar from '../../../components/common/TopBar';
import AddDomain from '../../../components/domains/AddDomain';
import Settings from '../../../components/settings/Settings';
import { useFetchSettings } from '../../../services/settings';
import { useFetchDomains } from '../../../services/domains';
import AuditPanel from '../../../components/audit/AuditPanel';
import Icon from '../../../components/common/Icon';
import Footer from '../../../components/common/Footer';

/** PoloRank — audit detail for one client: the blocks, and what is passing or failing inside each. */
const AuditDetail: NextPage = () => {
   const router = useRouter();
   const auth = useAuthUser();
   const [showSettings, setShowSettings] = useState(false);
   const [showAddDomain, setShowAddDomain] = useState(false);
   const { data: appSettingsData } = useFetchSettings();
   const { data: domainsData } = useFetchDomains(router);
   const domains: DomainType[] = domainsData?.domains || [];

   const activeDomain: DomainType | null = useMemo(() => {
      if (!domainsData?.domains || !router.query?.slug) { return null; }
      return domainsData.domains.find((x: DomainType) => x.slug === router.query.slug) || null;
   }, [router.query.slug, domainsData]);

   return (
      <div className="Audit flex flex-col min-h-screen">
         <Head>
            <title>{`Auditoría ${activeDomain?.domain || ''} - PoloRank`}</title>
         </Head>
         <TopBar user={auth.user} showSettings={() => setShowSettings(true)} showAddModal={() => setShowAddDomain(true)} />

         <div className="flex flex-col w-full max-w-5xl mx-auto p-6 lg:mt-24 lg:p-0">
            <div className='flex items-center justify-between mb-2'>
               <div>
                  <Link href='/audit' passHref={true}>
                     <a className='text-xs text-gray-400 hover:text-indigo-600'>
                        <Icon type='caret-left' size={12} color='currentColor' /> Auditoría
                     </a>
                  </Link>
                  <h2 className='text-lg font-semibold text-gray-700 mt-1'>{activeDomain?.domain || ''}</h2>
               </div>
               {activeDomain && (
                  <Link href={`/domain/${activeDomain.slug}`} passHref={true}>
                     <a className='text-xs text-gray-500 hover:text-indigo-600'>
                        <Icon type='tracking' size={12} color='currentColor' /> Ver seguimiento de posiciones
                     </a>
                  </Link>
               )}
            </div>

            <AuditPanel domain={activeDomain} />
         </div>

         <CSSTransition in={showAddDomain} timeout={300} classNames="modal_anim" unmountOnExit mountOnEnter>
            <AddDomain closeModal={() => setShowAddDomain(false)} domains={domains} />
         </CSSTransition>
         <CSSTransition in={showSettings} timeout={300} classNames="settings_anim" unmountOnExit mountOnEnter>
            <Settings closeSettings={() => setShowSettings(false)} />
         </CSSTransition>
         <Footer currentVersion={appSettingsData?.settings?.version || ''} />
      </div>
   );
};

export const getServerSideProps: GetServerSideProps = async (ctx) => guardPage(ctx, { slugParam: 'slug' });

export default AuditDetail;
