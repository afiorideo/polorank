import React, { useState } from 'react';
import type { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { CSSTransition } from 'react-transition-group';
import { guardPage } from '../../utils/auth/pageGuard';
import { useAuthUser } from '../../services/auth';
import TopBar from '../../components/common/TopBar';
import AddDomain from '../../components/domains/AddDomain';
import Settings from '../../components/settings/Settings';
import { useFetchSettings } from '../../services/settings';
import { useFetchDomains } from '../../services/domains';
import AuditDomainItem from '../../components/audit/AuditDomainItem';
import Icon from '../../components/common/Icon';
import Footer from '../../components/common/Footer';

/** PoloRank — audit portfolio: every client at a glance, the same way the Domains screen lists them. */
const AuditIndex: NextPage = () => {
   const router = useRouter();
   const auth = useAuthUser();
   const [showSettings, setShowSettings] = useState(false);
   const [showAddDomain, setShowAddDomain] = useState(false);
   const { data: appSettingsData } = useFetchSettings();
   const { data: domainsData, isLoading } = useFetchDomains(router, true);
   const domains: DomainType[] = domainsData?.domains || [];

   return (
      <div data-testid="audit" className="Audit flex flex-col min-h-screen">
         <Head>
            <title>Auditoría - PoloRank</title>
         </Head>
         <TopBar user={auth.user} showSettings={() => setShowSettings(true)} showAddModal={() => setShowAddDomain(true)} />

         <div className="flex flex-col w-full max-w-5xl mx-auto p-6 lg:mt-24 lg:p-0">
            <div className='mb-2'>
               <h2 className='text-lg font-semibold text-gray-700'>Auditoría SEO</h2>
               <p className='text-sm text-gray-500 mt-1'>
                  Qué tan optimizado está cada sitio, bloque por bloque, y cómo evoluciona en el tiempo.
               </p>
            </div>

            <div className='flex w-full flex-col mb-8'>
               {domains.map((domain: DomainType) => <AuditDomainItem key={domain.ID} domain={domain} />)}
               {isLoading && (
                  <div className='mt-4 p-5 py-12 rounded border text-center bg-surface text-sm'>
                     <Icon type="loading" /> Cargando dominios...
                  </div>
               )}
               {!isLoading && domains.length === 0 && (
                  <div className='mt-4 p-5 py-12 rounded border text-center bg-surface text-sm text-gray-500'>
                     No hay dominios todavía. Agregá uno para poder auditarlo.
                  </div>
               )}
            </div>
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

export const getServerSideProps: GetServerSideProps = async (ctx) => guardPage(ctx, {});

export default AuditIndex;
