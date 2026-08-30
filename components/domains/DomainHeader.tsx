import { useRouter } from 'next/router';
import { useState } from 'react';
import Link from 'next/link';
import { useRefreshKeywords } from '../../services/keywords';
import Icon from '../common/Icon';
import SelectField from '../common/SelectField';

type DomainHeaderProps = {
   domain: DomainType,
   domains: DomainType[],
   showAddModal: Function,
   showSettingsModal: Function,
   exportCsv:Function,
   scFilter?: string
   setScFilter?: Function
   showIdeaUpdateModal?:Function
   /** PoloRank: what the current user may do here (defaults: everything, for tests/legacy) */
   permissions?: { canRefresh?: boolean, canManageKeywords?: boolean, canManageDomain?: boolean },
}

const DomainHeader = (
   {
      domain, showAddModal, showSettingsModal, exportCsv, domains, scFilter = 'thirtyDays', setScFilter, showIdeaUpdateModal, permissions,
   }: DomainHeaderProps,
) => {
   const canRefresh = permissions?.canRefresh !== false;
   const canManageKeywords = permissions?.canManageKeywords !== false;
   const canManageDomain = permissions?.canManageDomain !== false;
   const router = useRouter();
   const [showOptions, setShowOptions] = useState<boolean>(false);
   const [ShowSCDates, setShowSCDates] = useState<boolean>(false);
   const { mutate: refreshMutate } = useRefreshKeywords(() => {});
   const isConsole = router.pathname === '/domain/console/[slug]';
   const isInsight = router.pathname === '/domain/insight/[slug]';
   const isIdeas = router.pathname === '/domain/ideas/[slug]';

   const daysName = (dayKey:string) => dayKey.replace('three', '3').replace('seven', '7').replace('thirty', '30').replace('Days', ' Days');
   const buttonStyle = 'leading-6 inline-block px-2 py-2 text-gray-500 hover:text-gray-700';
   const buttonLabelStyle = 'ml-2 text-sm not-italic lg:invisible lg:opacity-0';
   const tabStyle = 'rounded rounded-b-none cursor-pointer border-line border-b-0';
   const scDataFilterStlye = 'px-3 py-2 block w-full';
   return (
      <div className='domain_keywords_head w-full '>
         <div>
            <h1 className="hidden lg:block text-xl font-bold my-3" data-testid="domain-header">
               {domain && domain.domain && <><i className=' capitalize font-bold not-italic'>{domain.domain.charAt(0)}</i>{domain.domain.slice(1)}</>}
            </h1>
            <div className='domain_selector bg-surface mt-2 lg:hidden'>
               <SelectField
               options={domains && domains.length > 0 ? domains.map((d) => { return { label: d.domain, value: d.slug }; }) : []}
               selected={[domain.slug]}
               defaultLabel="Select Domain"
               updateField={(updateSlug:[string]) => updateSlug && updateSlug[0] && router.push(`${updateSlug[0]}`)}
               multiple={false}
               rounded={'rounded'}
               />
            </div>
         </div>
      <div className='flex w-full justify-between mt-4 lg:mt-0'>
         <ul className=' max-w-[270px] overflow-auto flex items-end text-sm relative top-[2px] lg:max-w-none'>
            <li className={`${tabStyle} ${router.pathname === '/domain/[slug]' ? 'bg-surface border border-b-0 font-semibold' : ''}`}>
               <Link href={`/domain/${domain.slug}`} passHref={true}>
                  <a className='px-4 py-2 inline-block'><Icon type="tracking" color='currentColor' classes='hidden lg:inline-block' />
                     <span className='text-xs lg:text-sm lg:ml-2'>Tracking</span>
                  </a>
               </Link>
            </li>
            <li className={`${tabStyle} ${router.pathname === '/domain/console/[slug]' ? 'bg-surface border border-b-0 font-semibold' : ''}`}>
               <Link href={`/domain/console/${domain.slug}`} passHref={true}>
                  <a className='px-4 py-2 inline-block'><Icon type="google" size={13} classes='hidden lg:inline-block' />
                     <span className='text-xs lg:text-sm lg:ml-2'>Discover</span>
                     <Icon type='help' size={14} color="#aaa" classes="ml-2 hidden lg:inline-block" title='Discover Keywords you already Rank For' />
                  </a>
               </Link>
            </li>
            <li className={`${tabStyle} ${router.pathname === '/domain/insight/[slug]' ? 'bg-surface border border-b-0 font-semibold' : ''}`}>
               <Link href={`/domain/insight/${domain.slug}`} passHref={true}>
                  <a className='px-4 py-2 inline-block'><Icon type="google" size={13} classes='hidden lg:inline-block' />
                     <span className='text-xs lg:text-sm lg:ml-2'>Insight</span>
                     <Icon type='help' size={14} color="#aaa" classes="ml-2 hidden lg:inline-block" title='Insight for Google Search Console Data' />
                  </a>
               </Link>
            </li>
            <li className={`${tabStyle} ${router.pathname === '/domain/audit/[slug]' ? 'bg-surface border border-b-0 font-semibold' : ''}`}>
               <Link href={`/domain/audit/${domain.slug}`} passHref={true}>
                  <a className='px-4 py-2 inline-block'><Icon type="research" size={13} classes='hidden lg:inline-block' />
                     <span className='text-xs lg:text-sm lg:ml-2'>Auditoría</span>
                     <Icon
                     type='help'
                     size={14}
                     color="#aaa"
                     classes="ml-2 hidden lg:inline-block"
                     title='Qué tan optimizado está el sitio, bloque por bloque'
                     />
                  </a>
               </Link>
            </li>
            <li className={`${tabStyle} ${router.pathname === '/domain/ideas/[slug]' ? 'bg-surface border border-b-0 font-semibold' : ''}`}>
               <Link href={`/domain/ideas/${domain.slug}`} passHref={true}>
                  <a className='px-4 py-2 inline-block'><Icon type="adwords" size={13} classes='hidden lg:inline-block' />
                     <span className='text-xs lg:text-sm lg:ml-2'>Ideas</span>
                     <Icon
                     type='help'
                     size={14}
                     color="#aaa"
                     classes="ml-2 hidden lg:inline-block"
                     title='Get Keyword Ideas for this domain from Google Ads'
                     />
                  </a>
               </Link>
            </li>
         </ul>
         <div className={'flex mb-0 lg:mb-1 lg:mt-3'}>
            {!isInsight && <button className={`${buttonStyle} lg:hidden`} onClick={() => setShowOptions(!showOptions)}>
               <Icon type='dots' size={20} />
            </button>
            }
            {isInsight && <button className={`${buttonStyle} lg:hidden invisible`}>x</button>}
            <div
            className={`hidden w-40 ml-[-70px] lg:block absolute mt-10 bg-surface border border-gray-100 z-40 rounded 
            lg:z-auto lg:relative lg:mt-0 lg:border-0 lg:w-auto lg:bg-transparent`}
            style={{ display: showOptions ? 'block' : undefined }}>
               {!isInsight && (
                  <button
                  className={`domheader_action_button relative ${buttonStyle}`}
                  aria-pressed="false"
                  onClick={() => exportCsv()}>
                     <Icon type='download' size={20} /><i className={`${buttonLabelStyle}`}>Exportar CSV</i>
                  </button>
               )}
               {!isConsole && !isInsight && !isIdeas && canRefresh && (
                  <button
                  className={`domheader_action_button relative ${buttonStyle} lg:ml-3`}
                  aria-pressed="false"
                  onClick={() => refreshMutate({ ids: [], domain: domain.domain })}>
                     <Icon type='reload' size={14} /><i className={`${buttonLabelStyle}`}>Refrescar posiciones</i>
                  </button>
                )}
               {canManageDomain && <button
               data-testid="show_domain_settings"
               className={`domheader_action_button relative ${buttonStyle} lg:ml-3`}
               aria-pressed="false"
               onClick={() => showSettingsModal(true)}><Icon type='settings' size={20} />
                  <i className={`${buttonLabelStyle}`}>Config. del dominio</i>
               </button>}
            </div>
            {!isConsole && !isInsight && !isIdeas && canManageKeywords && (
               <button
               data-testid="add_keyword"
               className={'ml-2 inline-block text-blue-700 font-bold text-sm lg:px-4 lg:py-2'}
               onClick={() => showAddModal(true)}>
                  <span
                  className='text-center leading-4 mr-2 inline-block rounded-full w-7 h-7 pt-1 bg-blue-700 text-white font-bold text-lg'>+</span>
                  <i className=' not-italic hidden lg:inline-block'>Agregar keyword</i>
               </button>
            )}
            {isConsole && (
               <div className='text-xs pl-4 ml-2 border-l border-gray-200 relative'>
                  {/* <span className='hidden lg:inline-block'>Data From Last: </span> */}
                  <span className='block cursor-pointer py-3' onClick={() => setShowSCDates(!ShowSCDates)}>
                     <Icon type='date' size={13} classes="mr-1" /> {daysName(scFilter)}
                  </span>
                  {ShowSCDates && (
                     <div className='absolute w-24 z-50 mt-0 right-0 bg-surface border border-gray-200 rounded text-center'>
                        {['threeDays', 'sevenDays', 'thirtyDays'].map((itemKey) => {
                           return <button
                                    key={itemKey}
                                    className={`${scDataFilterStlye} ${scFilter === itemKey ? ' bg-indigo-100 text-indigo-600' : ''}`}
                                    onClick={() => { setShowSCDates(false); if (setScFilter) setScFilter(itemKey); }}
                                    >Last {daysName(itemKey)}
                                 </button>;
                        })}
                     </div>
                  )}
               </div>
            )}
            {isIdeas && (
               <button
               data-testid="load_ideas"
               className={'ml-2 text-blue-700 font-bold text-sm flex items-center lg:px-4 lg:py-2'}
               onClick={() => showIdeaUpdateModal && showIdeaUpdateModal()}>
                  <span
                  className='text-center leading-4 mr-2 inline-block rounded-full w-7 h-7 pt-1 bg-blue-700 text-white font-bold text-lg'>
                     <Icon type='reload' size={12} />
                  </span>
                  <i className=' not-italic hidden lg:inline-block'>Load Ideas</i>
               </button>
            )}
         </div>
      </div>
      </div>
   );
};

export default DomainHeader;
