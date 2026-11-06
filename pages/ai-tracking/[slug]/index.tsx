import React, { useEffect, useMemo, useState } from 'react';
import type { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
// import { useQuery } from 'react-query';
import toast from 'react-hot-toast';
import { CSSTransition } from 'react-transition-group';
import { guardPage } from '../../../utils/auth/pageGuard';
import { useAuthUser } from '../../../services/auth';
import Sidebar from '../../../components/common/Sidebar';
import TopBar from '../../../components/common/TopBar';
import DomainHeader from '../../../components/domains/DomainHeader';
import AddDomain from '../../../components/domains/AddDomain';
import DomainSettings from '../../../components/domains/DomainSettings';
import exportCSV from '../../../utils/client/exportcsv';
import Settings from '../../../components/settings/Settings';
import { useFetchDomains } from '../../../services/domains';
import AiTrackingTable from '../../../components/aitracking/AiTrackingTable';
import { useFetchAiTracking } from '../../../services/aiTracking';
import { useFetchSettings } from '../../../services/settings';
import AssistantsView from '../../../components/aivisibility/AssistantsView';
import RunNowButton from '../../../components/aivisibility/RunNowButton';
import GoogleIaStatus from '../../../components/aitracking/GoogleIaStatus';
import Footer from '../../../components/common/Footer';

const AiTrackingPage: NextPage = () => {
   const router = useRouter();
   const auth = useAuthUser();
   const [showDomainSettings, setShowDomainSettings] = useState(false);
   const [showSettings, setShowSettings] = useState(false);
   const [showAddDomain, setShowAddDomain] = useState(false);
   const [view, setView] = useState<'assistants' | 'google'>('assistants');
   const [scDateFilter, setSCDateFilter] = useState('thirtyDays');
   const { data: appSettings } = useFetchSettings();
   const { data: domainsData } = useFetchDomains(router);
   const theDomains: DomainType[] = (domainsData && domainsData.domains) || [];

   const activDomain: DomainType|null = useMemo(() => {
      let active:DomainType|null = null;
      if (domainsData?.domains && router.query?.slug) {
         active = domainsData.domains.find((x:DomainType) => x.slug === router.query.slug) || null;
      }
      return active;
   }, [router.query.slug, domainsData]);

   // tras "Actualizar Google IA" la corrida sigue en segundo plano: refrescar la tabla cada 20 s (máx. 5 min) hasta que
   // cambie la última medición. Se guarda la fecha de la medición previa ('' si no había), no la hora del navegador.
   const [startedAt, setStartedAt] = useState<string | null>(null);
   useEffect(() => {
      if (startedAt === null) { return undefined; }
      const t = setTimeout(() => setStartedAt(null), 5 * 60 * 1000);
      return () => clearTimeout(t);
   }, [startedAt]);
   const { data: aiData, isLoading: aiLoading } = useFetchAiTracking(activDomain?.domain, startedAt !== null ? 20000 : false);
   useEffect(() => {
      const m = aiData?.measure;
      if (startedAt !== null && m && m.at !== startedAt) {
         toast(`Google IA actualizada: ${m.keywords} palabras clave, ${m.untrusted} con página no confiable`, { icon: '✔️' });
         setStartedAt(null);
      }
   }, [aiData, startedAt]);

   return (
      <div className="Domain ">
         {activDomain && activDomain.domain
         && <Head>
               <title>{`${activDomain.domain} - PoloRank` } </title>
            </Head>
         }
         <TopBar user={auth.user} showSettings={() => setShowSettings(true)} showAddModal={() => setShowAddDomain(true)} />
         <div className="flex w-full max-w-7xl mx-auto">
            <Sidebar canAddDomain={auth.canManageDomains} domains={theDomains} showAddModal={() => setShowAddDomain(true)} />
            <div className="domain_keywords px-5 pt-10 lg:px-0 lg:pt-8 w-full">
               {activDomain && activDomain.domain
               ? <DomainHeader
                  permissions={{
                     canRefresh: auth.canRefresh,
                     canManageKeywords: auth.canManageKeywords(activDomain?.domain),
                     canManageDomain: auth.canManageDomains,
                  }}
                  domain={activDomain}
                  domains={theDomains}
                  showAddModal={() => console.log('XXXXX')}
                  showSettingsModal={setShowDomainSettings}
                  exportCsv={() => exportCSV([], activDomain.domain, scDateFilter)}
                  scFilter={scDateFilter}
                  setScFilter={(item:string) => setSCDateFilter(item)}
                  />
                  : <div className='w-full lg:h-[100px]'></div>
               }
               {activDomain && (
                  <div className='mt-5'>
                     <div className='flex flex-wrap items-start justify-between gap-2'>
                     <div className='inline-flex rounded border overflow-hidden text-sm mb-4'>
                        <button
                        className={`px-4 py-1.5 ${view === 'assistants' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500'}`}
                        onClick={() => setView('assistants')}>
                           Asistentes IA <span className='text-gray-400 font-normal'>(prompts)</span>
                        </button>
                        <button
                        className={`px-4 py-1.5 border-l ${view === 'google' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500'}`}
                        onClick={() => setView('google')}>
                           Google IA <span className='text-gray-400 font-normal'>(palabras clave)</span>
                        </button>
                     </div>
                     {view === 'google' && (
                        <RunNowButton
                        domain={activDomain.domain}
                        canRun={auth.isSuperadmin}
                        scope={{ scope: 'google', domain: activDomain.domain }}
                        label='↻ Actualizar Google IA'
                        onStarted={() => setStartedAt(aiData?.measure?.at || '')}
                        />
                     )}
                     </div>
                     {view === 'assistants'
                        ? <AssistantsView domain={activDomain.domain} />
                        : <>
                           <GoogleIaStatus measure={aiData?.measure || null} inProgress={!!aiData?.inProgress} />
                           <AiTrackingTable rows={aiData?.rows || []} domain={activDomain.domain} isLoading={aiLoading} />
                        </>}
                  </div>
               )}
            </div>
         </div>

         <CSSTransition in={showAddDomain} timeout={300} classNames="modal_anim" unmountOnExit mountOnEnter>
            <AddDomain closeModal={() => setShowAddDomain(false)} domains={domainsData?.domains || []} />
         </CSSTransition>

         <CSSTransition in={showDomainSettings} timeout={300} classNames="modal_anim" unmountOnExit mountOnEnter>
            <DomainSettings
            domain={showDomainSettings && theDomains && activDomain && activDomain.domain ? activDomain : false}
            closeModal={setShowDomainSettings}
            />
         </CSSTransition>
         <CSSTransition in={showSettings} timeout={300} classNames="settings_anim" unmountOnExit mountOnEnter>
             <Settings closeSettings={() => setShowSettings(false)} />
         </CSSTransition>
         <Footer currentVersion={appSettings?.settings?.version ? appSettings.settings.version : ''} />
      </div>
   );
};

export const getServerSideProps: GetServerSideProps = async (ctx) => guardPage(ctx, { slugParam: 'slug' });

export default AiTrackingPage;
