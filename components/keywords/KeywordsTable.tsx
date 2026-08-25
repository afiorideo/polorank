import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Toaster } from 'react-hot-toast';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { filterKeywords, keywordsByDevice, sortKeywords } from '../../utils/client/sortFilter';
import Icon from '../common/Icon';
import Keyword, { DEFAULT_TRACKING_COLUMNS } from './Keyword';
import KeywordDetails from './KeywordDetails';
import KeywordFilters from './KeywordFilter';
import Modal from '../common/Modal';
import { useDeleteKeywords, useFavKeywords, useRefreshKeywords } from '../../services/keywords';
import KeywordTagManager from './KeywordTagManager';
import AddTags from './AddTags';
import KeywordScrapeSettings from './KeywordScrapeSettings';
import useWindowResize from '../../hooks/useWindowResize';
import useIsMobile from '../../hooks/useIsMobile';
import { useUpdateSettings } from '../../services/settings';
import { defaultSettings } from '../settings/Settings';

type KeywordsTableProps = {
   domain: DomainType | null,
   keywords: KeywordType[],
   isLoading: boolean,
   showAddModal: boolean,
   setShowAddModal: Function,
   isConsoleIntegrated: boolean,
   settings?: SettingsType,
   /** PoloRank: what the current user may do (defaults: everything, for tests/legacy) */
   permissions?: { canRefresh?: boolean, canManageKeywords?: boolean },
}

type CompareDays = 7 | 30 | 60 | 90;
const COMPARE_VALUES: CompareDays[] = [7, 30, 60, 90];

/** Read trend/top/cmp from the URL so a link keeps the view (spec §8.2). */
const filtersFromQuery = (query: { [k: string]: string | string[] | undefined }): Partial<KeywordFilters> => {
   const out: Partial<KeywordFilters> = {};
   const trend = String(query.trend || '');
   const top = String(query.top || '');
   const cmp = parseInt(String(query.cmp || ''), 10) as CompareDays;
   if (trend === 'up' || trend === 'down') { out.trend = trend; }
   if (top === '10' || top === '20') { out.top = top; }
   if (COMPARE_VALUES.includes(cmp)) { out.compare = cmp; }
   return out;
};

const KeywordsTable = (props: KeywordsTableProps) => {
   const router = useRouter();
   const { keywords = [], isLoading = true, isConsoleIntegrated = false, settings, permissions } = props;
   const canRefresh = permissions?.canRefresh !== false;
   const canManageKeywords = permissions?.canManageKeywords !== false;
   const showSCData = isConsoleIntegrated;
   const [device, setDevice] = useState<string>('desktop');
   const [deviceAutoPicked, setDeviceAutoPicked] = useState(false);
   const [selectedKeywords, setSelectedKeywords] = useState<number[]>([]);
   const [showKeyDetails, setShowKeyDetails] = useState<KeywordType|null>(null);
   const [showRemoveModal, setShowRemoveModal] = useState<boolean>(false);
   const [showTagManager, setShowTagManager] = useState<null|number>(null);
   const [showAddTags, setShowAddTags] = useState<boolean>(false);
   const [scrapeTargets, setScrapeTargets] = useState<number[] | null>(null);
   const [SCListHeight, setSCListHeight] = useState(500);
   const [filterParams, setFilterParams] = useState<KeywordFilters>({
      countries: [], tags: [], search: '', trend: 'all', top: 'all', compare: 30, ...filtersFromQuery(router?.query || {}),
   });
   const [sortBy, setSortBy] = useState<string>('date_asc');
   const [scDataType, setScDataType] = useState<string>('threeDays');
   const [showScDataTypes, setShowScDataTypes] = useState<boolean>(false);
   const { mutate: deleteMutate } = useDeleteKeywords(() => {});
   const { mutate: favoriteMutate } = useFavKeywords(() => {});
   const { mutate: refreshMutate } = useRefreshKeywords(() => {});
   const [isMobile] = useIsMobile();

   useWindowResize(() => {
      setSCListHeight(window.innerHeight - (isMobile ? 200 : 400));
   });

   // First load: open the device tab that actually has keywords (e.g. a domain tracked only on mobile)
   useEffect(() => {
      if (deviceAutoPicked || keywords.length === 0) { return; }
      const desktopCount = keywords.filter((k) => k.device === 'desktop').length;
      const mobileCount = keywords.filter((k) => k.device === 'mobile').length;
      if (desktopCount === 0 && mobileCount > 0) { setDevice('mobile'); }
      setDeviceAutoPicked(true);
   }, [keywords, deviceAutoPicked]);

   // Keep trend/top/cmp in the URL (shallow) so the current view can be shared/bookmarked
   useEffect(() => {
      if (!router || !router.isReady) { return; }
      const next: { [k: string]: string } = {};
      Object.keys(router.query).forEach((k) => { if (!['trend', 'top', 'cmp'].includes(k)) { next[k] = String(router.query[k]); } });
      if (filterParams.trend && filterParams.trend !== 'all') { next.trend = filterParams.trend; }
      if (filterParams.top && filterParams.top !== 'all') { next.top = filterParams.top; }
      if (filterParams.compare && filterParams.compare !== 30) { next.cmp = String(filterParams.compare); }
      const current = { ...router.query } as { [k: string]: string };
      const same = Object.keys(next).length === Object.keys(current).length && Object.keys(next).every((k) => String(current[k]) === next[k]);
      if (!same) { router.replace({ pathname: router.pathname, query: next }, undefined, { shallow: true }); }
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [filterParams.trend, filterParams.top, filterParams.compare]);

   const tableColumns = settings?.trackingColumns || DEFAULT_TRACKING_COLUMNS;
   const { mutate: updateMutate } = useUpdateSettings(() => console.log(''));
   const compareDays: CompareDays = filterParams.compare || 30;

   const scDataObject:{ [k:string] : string} = {
      threeDays: 'Últimos 3 días',
      sevenDays: 'Últimos 7 días',
      thirtyDays: 'Últimos 30 días',
      avgThreeDays: 'Promedio 3 días',
      avgSevenDays: 'Promedio 7 días',
      avgThirtyDays: 'Promedio 30 días',
   };

   const processedKeywords: {[key:string] : KeywordType[]} = useMemo(() => {
      const procKeywords = keywords.filter((x) => x.device === device);
      const filteredKeywords = filterKeywords(procKeywords, filterParams);
      const sortedKeywords = sortKeywords(filteredKeywords, sortBy, scDataType, compareDays);
      return keywordsByDevice(sortedKeywords, device);
   }, [keywords, device, sortBy, filterParams, scDataType, compareDays]);

   const visibleKeywords = processedKeywords[device] || [];

   const allDomainTags: string[] = useMemo(() => {
      const allTags = keywords.reduce((acc: string[], keyword) => [...acc, ...keyword.tags], []).filter((t) => t && t.trim() !== '');
      return [...new Set(allTags)];
   }, [keywords]);

   const selectKeyword = (keywordID: number) => {
      let updatedSelectd = [...selectedKeywords, keywordID];
      if (selectedKeywords.includes(keywordID)) {
         updatedSelectd = selectedKeywords.filter((keyID) => keyID !== keywordID);
      }
      setSelectedKeywords(updatedSelectd);
   };

   const updateColumns = (column:string) => {
      const newColumns = tableColumns.includes(column) ? tableColumns.filter((col) => col !== column) : [...tableColumns, column];
      updateMutate({ ...defaultSettings, ...settings, trackingColumns: newColumns });
   };

   const show = useCallback((col:string) => tableColumns.includes(col), [tableColumns]);

   /** Click on a header toggles asc/desc for that column. */
   const headerSort = (asc: string, desc: string) => setSortBy(sortBy === asc ? desc : asc);
   const sortMark = (asc: string, desc: string) => {
      if (sortBy === asc) { return <span className='ml-1 text-indigo-500'>↑</span>; }
      if (sortBy === desc) { return <span className='ml-1 text-indigo-500'>↓</span>; }
      return null;
   };
   const th = 'shrink-0 cursor-pointer select-none hover:text-indigo-600';

   // Navigation inside the side panel (previous / next keyword of the current view)
   const detailIndex = showKeyDetails ? visibleKeywords.findIndex((k) => k.ID === showKeyDetails.ID) : -1;
   const openDetailsAt = (idx: number) => { if (idx >= 0 && idx < visibleKeywords.length) { setShowKeyDetails(visibleKeywords[idx]); } };

   const Row = ({ data, index, style }:ListChildComponentProps) => {
      const keyword = data[index];
      return (
         <Keyword
         key={keyword.ID}
         style={style}
         canRefresh={canRefresh}
         canManage={canManageKeywords}
         index={index}
         selected={selectedKeywords.includes(keyword.ID)}
         selectKeyword={selectKeyword}
         keywordData={keyword}
         refreshkeyword={() => refreshMutate({ ids: [keyword.ID] })}
         favoriteKeyword={favoriteMutate}
         manageTags={() => setShowTagManager(keyword.ID)}
         manageScrape={() => setScrapeTargets([keyword.ID])}
         removeKeyword={() => { setSelectedKeywords([keyword.ID]); setShowRemoveModal(true); }}
         showKeywordDetails={() => setShowKeyDetails(keyword)}
         lastItem={index === (visibleKeywords.length - 1)}
         showSCData={showSCData}
         scDataType={scDataType}
         tableColumns={tableColumns}
         compareDays={compareDays}
         />
      );
   };

   const selectedAllItems = visibleKeywords.length > 0 && selectedKeywords.length === visibleKeywords.length;
   const deviceCount = keywords.filter((k) => k.device === device).length;

   return (
      <div>
         <div className='domKeywords flex flex-col bg-surface rounded-md text-sm border mb-5'>
            {selectedKeywords.length > 0 && (
               <div className='font-semibold text-sm py-4 px-8 text-gray-500 '>
                  <ul className=''>
                     <li className='inline-block mr-4 text-gray-400'>
                        {selectedKeywords.length} seleccionada{selectedKeywords.length > 1 ? 's' : ''}
                     </li>
                     {canRefresh && <li className='inline-block mr-4'>
                        <a
                        className='block px-2 py-2 cursor-pointer hover:text-indigo-600'
                        onClick={() => { refreshMutate({ ids: selectedKeywords }); setSelectedKeywords([]); }}
                        >
                           <span className=' bg-indigo-100 text-blue-700 px-1 rounded'><Icon type="reload" size={11} /></span> Refrescar
                        </a>
                     </li>}
                     {canManageKeywords && <li className='inline-block mr-4'>
                        <a
                        className='block px-2 py-2 cursor-pointer hover:text-indigo-600'
                        onClick={() => setShowRemoveModal(true)}
                        >
                           <span className=' bg-red-100 text-red-600 px-1 rounded'><Icon type="trash" size={14} /></span> Quitar</a>
                     </li>}
                     {canManageKeywords && <li className='inline-block mr-4'>
                        <a
                        className='block px-2 py-2 cursor-pointer hover:text-indigo-600'
                        onClick={() => setShowAddTags(true)}
                        >
                           <span className=' bg-green-100 text-green-500  px-1 rounded'><Icon type="tags" size={14} /></span> Etiquetar</a>
                     </li>}
                     {canManageKeywords && <li className='inline-block mr-4'>
                        <a
                        className='block px-2 py-2 cursor-pointer hover:text-indigo-600'
                        onClick={() => setScrapeTargets(selectedKeywords)}
                        >
                           <span className=' bg-slate-100 text-slate-500 px-1 rounded'><Icon type="search" size={14} /></span> Profundidad</a>
                     </li>}
                     <li className='inline-block'>
                        <a className='block px-2 py-2 cursor-pointer text-gray-400 hover:text-indigo-600' onClick={() => setSelectedKeywords([])}>
                           Deseleccionar
                        </a>
                     </li>
                  </ul>
               </div>
            )}
            {selectedKeywords.length === 0 && (
               <KeywordFilters
                  allTags={allDomainTags}
                  filterParams={filterParams}
                  filterKeywords={(params:KeywordFilters) => setFilterParams(params)}
                  updateSort={(sorted:string) => setSortBy(sorted)}
                  sortBy={sortBy}
                  keywords={keywords}
                  device={device}
                  setDevice={setDevice}
                  updateColumns={updateColumns}
                  tableColumns={tableColumns}
                  integratedConsole={isConsoleIntegrated}
               />
            )}
            <div className='domkeywordsTable domkeywordsTable--keywords styled-scrollbar w-full overflow-auto min-h-[60vh]'>
               <div className='lg:min-w-[1000px]'>
                  <div className='domKeywords_head hidden lg:flex items-center gap-2 py-3 px-6 bg-surface-2 text-[11px] uppercase tracking-wide
                   text-gray-500 font-semibold border-y'>
                     <button
                        className={`p-0 leading-[0px] inline-block rounded-sm pt-0 px-[1px] pb-[3px] border border-slate-300 shrink-0
                        ${selectedAllItems ? ' bg-blue-700 border-blue-700 text-white' : 'text-transparent'}`}
                        title='Seleccionar todas'
                        onClick={() => setSelectedKeywords(selectedAllItems ? [] : visibleKeywords.map((k: KeywordType) => k.ID))}
                        >
                           <Icon type="check" size={10} />
                     </button>
                     {show('Evol') && <span className='domKeywords_head_evol basis-[84px] shrink-0 text-center'>Evol.</span>}
                     <span className={`domKeywords_head_keyword flex-1 min-w-[180px] ${th}`} onClick={() => headerSort('alpha_asc', 'alpha_desc')}>
                        Keyword{sortMark('alpha_asc', 'alpha_desc')}
                     </span>
                     {show('Volume') && (
                        <span className={`domKeywords_head_volume basis-[64px] text-center ${th}`} onClick={() => headerSort('vol_desc', 'vol_asc')}>
                           Vol.{sortMark('vol_desc', 'vol_asc')}
                        </span>
                     )}
                     <span
                        className={`domKeywords_head_position basis-[96px] text-center ${th}`}
                        onClick={() => headerSort('pos_asc', 'pos_desc')}
                        title={`Flecha: cambio vs. hace ${compareDays} días`}>
                        Posición{sortMark('pos_asc', 'pos_desc')}
                     </span>
                     {show('Changes') && (
                        <>
                           {[30, 60, 90].map((d) => (
                              <span
                                 key={d}
                                 className={`domKeywords_head_d${d} basis-[64px] text-center ${th}`}
                                 title={`Cambio vs. hace ${d} días (posición de entonces entre paréntesis)`}
                                 onClick={() => {
                                    setFilterParams({ ...filterParams, compare: d as CompareDays });
                                    headerSort('change_desc', 'change_asc');
                                 }}>
                                 {d}d{compareDays === d ? sortMark('change_desc', 'change_asc') : null}
                              </span>
                           ))}
                        </>
                     )}
                     {show('Snippets') && (
                        <span className='domKeywords_head_snippets basis-[110px] shrink-0 text-center' title='Bloques especiales de la SERP'>
                           Snippets
                        </span>
                     )}
                     <span className='domKeywords_head_url flex-1 min-w-[110px]'>URL posicionada</span>
                     {show('Best') && (
                        <span
                           className={`domKeywords_head_best basis-[52px] text-center ${th}`}
                           onClick={() => headerSort('best_asc', 'pos_asc')}
                           title='Mejor posición histórica'>
                           Mejor{sortMark('best_asc', '')}
                        </span>
                     )}
                     {showSCData && show('Search Console') && (
                        <div className='domKeywords_head_sc basis-[170px] shrink-0 text-center relative'>
                           <div
                           className='select-none cursor-pointer inline-block bg-surface rounded-full px-2 py-[2px] border border-gray-200
                           normal-case tracking-normal'
                           onClick={() => setShowScDataTypes(!showScDataTypes)}>
                              <Icon type="google" size={11} /> {scDataObject[scDataType]}
                              <Icon classes="ml-1" type={showScDataTypes ? 'caret-up' : 'caret-down'} size={10} />
                           </div>
                           {showScDataTypes && (
                              <div className='absolute bg-surface border border-gray-200 z-50 w-44 rounded mt-1 text-gray-500
                              normal-case tracking-normal text-left'>
                                 {Object.keys(scDataObject).map((itemKey) => {
                                    return <span
                                             className={`block p-2 cursor-pointer hover:bg-indigo-50 hover:text-indigo-600
                                              ${scDataType === itemKey ? 'bg-indigo-100 text-indigo-600' : ''}`}
                                             key={itemKey}
                                             onClick={() => { setScDataType(itemKey); setShowScDataTypes(false); }}>
                                                {scDataObject[itemKey]}
                                             </span>;
                                 })}
                              </div>
                           )}
                           <div className='flex justify-between mt-1'>
                              <span className='min-w-[50px]'>Pos GSC</span>
                              <span className='min-w-[50px]'>Impr.</span>
                              <span className='min-w-[50px]'>Clics</span>
                           </div>
                        </div>
                     )}
                     <span className='basis-[28px] shrink-0' />
                  </div>
                  <div className='domKeywords_keywords border-gray-200 min-h-[55vh] relative'>
                     {visibleKeywords.length > 0 && (
                        <List
                        innerElementType="div"
                        itemData={visibleKeywords}
                        itemCount={visibleKeywords.length}
                        itemSize={isMobile ? 120 : 62}
                        height={SCListHeight}
                        width={'100%'}
                        className={'styled-scrollbar'}
                        >
                           {Row}
                        </List>
                     )}
                     {!isLoading && visibleKeywords.length === 0 && (
                        <p className=' p-9 pt-[10%] text-center text-gray-500'>
                           {deviceCount === 0 ? 'No hay keywords para este dispositivo.' : 'Ninguna keyword coincide con los filtros.'}
                        </p>
                     )}
                     {isLoading && (
                        <p className=' p-9 pt-[10%] text-center text-gray-500'>Cargando keywords…</p>
                     )}
                  </div>
               </div>
            </div>
         </div>
         {showKeyDetails && showKeyDetails.ID && (
            <KeywordDetails
               keyword={showKeyDetails}
               domain={props.domain}
               settings={settings}
               closeDetails={() => setShowKeyDetails(null)}
               onPrev={detailIndex > 0 ? () => openDetailsAt(detailIndex - 1) : undefined}
               onNext={detailIndex >= 0 && detailIndex < visibleKeywords.length - 1 ? () => openDetailsAt(detailIndex + 1) : undefined}
            />
         )}
         {showRemoveModal && selectedKeywords.length > 0 && (
            <Modal closeModal={() => { setSelectedKeywords([]); setShowRemoveModal(false); }} title={'Quitar keywords'}>
                  <div className='text-sm'>
                     <p>
                        ¿Seguro que quieres quitar {selectedKeywords.length > 1 ? `estas ${selectedKeywords.length} keywords` : 'esta keyword'}?
                        Se pierde su historial.
                     </p>
                     <div className='mt-6 text-right font-semibold'>
                        <button
                        className=' py-1 px-5 rounded cursor-pointer bg-indigo-50 text-slate-500 mr-3'
                        onClick={() => { setSelectedKeywords([]); setShowRemoveModal(false); }}>
                           Cancelar
                        </button>
                        <button
                        className=' py-1 px-5 rounded cursor-pointer bg-red-400 text-white'
                        onClick={() => { deleteMutate(selectedKeywords); setShowRemoveModal(false); setSelectedKeywords([]); }}>
                           Quitar
                        </button>
                     </div>
                  </div>
            </Modal>
         )}
         {scrapeTargets && scrapeTargets.length > 0 && (
            <KeywordScrapeSettings
               keywords={keywords.filter((k) => scrapeTargets.includes(k.ID))}
               domain={props.domain}
               settings={settings}
               closeModal={() => { setScrapeTargets(null); setSelectedKeywords([]); }}
               />
         )}
         {showTagManager && (
            <KeywordTagManager
               allTags={allDomainTags}
               keyword={keywords.find((k) => k.ID === showTagManager)}
               closeModal={() => setShowTagManager(null)}
               />
         )}
         {showAddTags && (
            <AddTags
               existingTags={allDomainTags}
               keywords={keywords.filter((k) => selectedKeywords.includes(k.ID))}
               closeModal={() => setShowAddTags(false)}
               />
         )}
         <Toaster position='bottom-center' containerClassName="react_toaster" />
      </div>
   );
 };

 export default KeywordsTable;
