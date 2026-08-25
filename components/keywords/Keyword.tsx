import React, { useState, useMemo } from 'react';
import TimeAgo from 'react-timeago';
import dayjs from 'dayjs';
import Icon from '../common/Icon';
import countries from '../../utils/countries';
import ChartSlim from '../common/ChartSlim';
import KeywordPosition from './KeywordPosition';
import PositionChange from './PositionChange';
import SerpFeatures from './SerpFeatures';
import { formattedNum } from '../../utils/client/helpers';
import { chartSeries, historyPoints } from '../../utils/history';
import { describeScrape } from '../../utils/depth';
import { ranksOtherPage, targetPath } from '../../utils/targetUrl';
import timeAgoFormatter from '../../utils/client/timeago';
import type { KeywordChange } from '../../utils/history';

export type CompareDays = 7 | 30 | 60 | 90;

type KeywordProps = {
   keywordData: KeywordType,
   selected: boolean,
   index: number,
   refreshkeyword: Function,
   favoriteKeyword: Function,
   removeKeyword: Function,
   selectKeyword: Function,
   manageTags: Function,
   showKeywordDetails: Function,
   /** PoloRank: open the per-keyword scrape depth dialog */
   manageScrape?: Function,
   /** PoloRank: open the "URL objetivo" dialog */
   manageTarget?: Function,
   /** PoloRank: render the "Landing" column (the table enables it when any keyword of the view has a target URL) */
   showLanding?: boolean,
   lastItem?:boolean,
   showSCData: boolean,
   scDataType: string,
   style: Object,
   maxTitleColumnWidth?: number,
   /** PoloRank: row actions allowed for the current user (default true) */
   canRefresh?: boolean,
   canManage?: boolean,
   tableColumns? : string[],
   /** PoloRank: comparison window for the arrow next to the position (default 30 days) */
   compareDays?: CompareDays,
}

/** Column visibility keys (see KeywordFilter → columnOptionChoices). */
export const DEFAULT_TRACKING_COLUMNS = ['Evol', 'Volume', 'Changes', 'Snippets', 'Best', 'Search Console'];

/** Fallback when the API did not send stats: change vs. the previous data point (SerpBear's original arrow). */
const changeVsPrevious = (history: KeywordHistory, position: number): KeywordChange => {
   const points = historyPoints(history);
   if (points.length < 2) { return { change: null, position: null }; }
   const prev = points[points.length - 2].position;
   if (prev === 0 && position === 0) { return { change: 0, position: 0 }; }
   const norm = (p: number) => (p > 0 ? p : 101);
   return { change: norm(prev) - norm(position), position: prev };
};

const Keyword = (props: KeywordProps) => {
   const canRefresh = props.canRefresh !== false;
   const canManage = props.canManage !== false;
   const {
      keywordData,
      refreshkeyword,
      favoriteKeyword,
      removeKeyword,
      selectKeyword,
      selected,
      showKeywordDetails,
      manageTags,
      manageScrape,
      manageTarget,
      showLanding = false,
      lastItem,
      showSCData = true,
      style,
      index,
      scDataType = 'threeDays',
      tableColumns = DEFAULT_TRACKING_COLUMNS,
      compareDays = 30,
   } = props;
   const {
      keyword, domain, ID, city, position, url = '', lastUpdated, country, sticky, history = {}, updating = false, lastUpdateError = false, volume,
      tags = [], serpFeatures = [], lastDepth = 0, stats, scrapeSettings = null,
      targetUrl = null, targetPosition = 0, targetStats,
   } = keywordData;
   const otherPage = ranksOtherPage(targetUrl, url, position);

   const [showOptions, setShowOptions] = useState(false);
   const [showPositionError, setPositionError] = useState(false);

   const turncatedURL = useMemo(() => {
      return url.replace(`https://${domain}`, '').replace(`https://www.${domain}`, '').replace(`http://${domain}`, '');
   }, [url, domain]);

   const chartData = useMemo(() => chartSeries(history, 30), [history]);

   const compareChange: KeywordChange = useMemo(() => {
      const key = `d${compareDays}` as 'd7' | 'd30' | 'd60' | 'd90';
      if (stats && stats.changes && stats.changes[key]) { return stats.changes[key]; }
      return changeVsPrevious(history, position);
   }, [stats, compareDays, history, position]);

   const bestPosition = stats?.best || null;
   const targetChange: KeywordChange | undefined = useMemo(() => {
      if (!targetUrl || !targetStats?.changes) { return undefined; }
      const key = `d${compareDays}` as 'd7' | 'd30' | 'd60' | 'd90';
      return targetStats.changes[key];
   }, [targetUrl, targetStats, compareDays]);
   const show = (col: string) => tableColumns.includes(col);
   const cell = 'hidden lg:block text-center shrink-0';
   const optionsButtonStyle = 'block px-2 py-2 cursor-pointer hover:bg-indigo-50 hover:text-blue-700';

   return (
      <div
      key={keyword + ID}
      style={style}
      data-testid='keyword_row'
      className={`keyword relative py-4 px-4 text-gray-600 border-b-[1px] border-gray-100 lg:py-2 lg:px-6 lg:border-0
      lg:flex lg:items-center lg:gap-2 ${selected ? ' bg-indigo-50 keyword--selected' : ''} ${lastItem ? 'border-b-0' : ''}`}>

         {/* selección */}
         <button
            data-testid='keyword_select'
            className={`keyword_select absolute top-4 left-4 lg:relative lg:top-0 lg:left-0 p-0 leading-[0px] inline-block rounded-sm
            pt-0 px-[1px] pb-[3px] border shrink-0 ${selected ? ' bg-blue-700 border-blue-700 text-white' : 'text-transparent'}`}
            onClick={() => selectKeyword(ID)}
            title='Seleccionar'>
               <Icon type="check" size={10} />
         </button>

         {/* Evol. — últimos 30 días */}
         {show('Evol') && (
            <div className={`${cell} keyword_evol basis-[84px] cursor-pointer`} onClick={() => showKeywordDetails()} title='Evolución 30 días'>
               {chartData.series.some((v) => v !== null)
                  ? <ChartSlim labels={chartData.labels} series={chartData.series} />
                  : <span className='text-gray-300' title='Sin posiciones en los últimos 30 días'>—</span>}
            </div>
         )}

         {/* Keyword */}
         <div className='keyword_title pl-7 lg:pl-0 font-semibold lg:flex-1 lg:min-w-[180px] overflow-hidden'>
            <a className='cursor-pointer hover:text-blue-600 flex items-center' onClick={() => showKeywordDetails()} title={keyword}>
               <span className={`fflag fflag-${country} w-[18px] h-[12px] mr-2 shrink-0`} title={countries[country] && countries[country][0]} />
               <span className='keyword_name inline-block text-ellipsis overflow-hidden whitespace-nowrap'>
                  {keyword}{city ? ` (${city})` : ''}
               </span>
               {sticky && <span className='ml-2 shrink-0' title='Favorita'><Icon type="star-filled" size={14} color="#fbd346" /></span>}
               {scrapeSettings && (
                  <span
                  className='keyword_scrape ml-2 shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 not-italic'
                  title='Profundidad de búsqueda propia (no hereda del dominio)'>
                     🔍 {describeScrape({
                        strategy: scrapeSettings.scrape_strategy,
                        paginationLimit: scrapeSettings.scrape_pagination_limit || 0,
                        smartFullFallback: !!scrapeSettings.scrape_smart_full_fallback,
                     })}
                  </span>
               )}
               {lastUpdateError && lastUpdateError.date && (
                  <button className='ml-2 shrink-0' onClick={(e) => { e.stopPropagation(); setPositionError(true); }} title='Error al actualizar'>
                     <Icon type="error" size={16} color="#FF3672" />
                  </button>
               )}
            </a>
            <div className='keyword_meta text-[11px] font-normal text-gray-400 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis'>
               {targetUrl && (
                  <span className='keyword_target mr-2 text-indigo-400' title={`URL objetivo: ${targetUrl}`}>
                     🎯 {targetPath(targetUrl, domain)}
                  </span>
               )}
               {tags.length > 0 && <span className='mr-2 text-indigo-400'>{tags.join(' · ')}</span>}
               <span title={dayjs(lastUpdated).format('DD-MMM-YYYY, HH:mm')}>
                  actualizado <TimeAgo date={lastUpdated} formatter={timeAgoFormatter} title={dayjs(lastUpdated).format('DD-MMM-YYYY, HH:mm')} />
               </span>
            </div>
         </div>

         {/* Vol. */}
         {show('Volume') && (
            <div className={`${cell} keyword_volume basis-[64px] text-gray-500`} title='Volumen mensual'>
               {volume ? formattedNum(volume) : '—'}
            </div>
         )}

         {/* Posición + cambio vs. "comparar con" */}
         <div className='keyword_position absolute top-3 right-4 lg:relative lg:top-0 lg:right-0 lg:basis-[96px] shrink-0 text-center'>
            <KeywordPosition position={position} updating={updating} badge resultsReceived={stats?.resultsReceived} lastDepth={lastDepth} />
            {!updating && <PositionChange change={compareChange} arrow className='keyword_change ml-1 text-xs' />}
         </div>

         {/* 30d · 60d · 90d */}
         {show('Changes') && (
            <>
               <div className={`${cell} keyword_d30 basis-[64px] text-xs`}><PositionChange change={stats?.changes?.d30} withPosition /></div>
               <div className={`${cell} keyword_d60 basis-[64px] text-xs`}><PositionChange change={stats?.changes?.d60} withPosition /></div>
               <div className={`${cell} keyword_d90 basis-[64px] text-xs`}><PositionChange change={stats?.changes?.d90} withPosition /></div>
            </>
         )}

         {/* Snippets */}
         {show('Snippets') && (
            <div className={`${cell} keyword_snippets basis-[110px]`}><SerpFeatures features={serpFeatures} /></div>
         )}

         {/* URL */}
         <div className='keyword_url mt-2 pl-7 lg:pl-0 lg:mt-0 lg:flex-1 lg:min-w-[110px] text-gray-400 text-xs overflow-hidden text-ellipsis
         whitespace-nowrap'>
            {url ? (
               <a href={url} target="_blank" rel="noreferrer" className={`hover:text-indigo-600 ${otherPage ? 'text-amber-600' : ''}`} title={url}>
                  <span className='mr-1 lg:hidden'><Icon type="link-alt" size={12} color='currentColor' /></span>
                  {otherPage && <span className='keyword_other_page mr-1' title='Rankea con una página distinta de la URL objetivo'>⚠</span>}
                  {turncatedURL || '/'}
               </a>
            ) : <span>—</span>}
         </div>

         {/* Landing (URL objetivo) */}
         {showLanding && (
            <div
            className={`${cell} keyword_landing basis-[84px]`}
            title={targetUrl ? `Posición de ${targetPath(targetUrl, domain)}` : 'Sin URL objetivo'}>
               {targetUrl ? (
                  <>
                     <KeywordPosition
                     position={targetPosition}
                     updating={updating}
                     badge
                     lastDepth={lastDepth}
                     resultsReceived={stats?.resultsReceived} />
                     {!updating && targetChange && <PositionChange change={targetChange} arrow className='ml-1 text-xs' />}
                  </>
               ) : <span className='text-gray-300'>—</span>}
            </div>
         )}

         {/* Mejor */}
         {show('Best') && (
            <div
            className={`${cell} keyword_best basis-[52px] font-semibold text-gray-500`}
            title={bestPosition ? `Mejor posición el ${dayjs(bestPosition.date).format('DD-MMM-YYYY')}` : 'Sin historial'}>
               {bestPosition ? bestPosition.position : (position || '—')}
            </div>
         )}

         {/* Search Console */}
         {showSCData && show('Search Console') && (
            <div className='keyword_sc_data hidden lg:flex basis-[170px] shrink-0 justify-between text-center text-xs text-gray-500'>
               <span className='min-w-[50px]' title='Posición promedio en Search Console'>
                  <KeywordPosition position={keywordData?.scData?.position[scDataType as keyof KeywordSCDataChild] || 0} type='sc' />
               </span>
               <span className='min-w-[50px]' title='Impresiones'>
                  {keywordData?.scData?.impressions[scDataType as keyof KeywordSCDataChild] || 0}
               </span>
               <span className='min-w-[50px]' title='Clics'>{keywordData?.scData?.visits[scDataType as keyof KeywordSCDataChild] || 0}</span>
            </div>
         )}

         {/* acciones */}
         <div className='keyword_actions absolute right-2 bottom-2 lg:relative lg:right-0 lg:bottom-0 lg:basis-[28px] shrink-0'>
            <button
            className={`keyword_dots rounded px-1 text-indigo-300 hover:bg-indigo-50 ${showOptions ? 'bg-indigo-50 text-indigo-600 ' : ''}`}
            onClick={() => setShowOptions(!showOptions)}
            title='Acciones'>
               <Icon type="dots" size={20} />
            </button>
            {showOptions && (
               <ul className='keyword_options customShadow absolute w-[190px] right-0 bg-surface rounded border z-20 text-sm'>
                  {canRefresh && <li>
                     <a className={optionsButtonStyle} onClick={() => { refreshkeyword([ID]); setShowOptions(false); }}>
                     <span className=' bg-indigo-100 text-blue-700 px-1 rounded'><Icon type="reload" size={11} /></span> Refrescar posición</a>
                  </li>}
                  {canManage && <li>
                     <a className={optionsButtonStyle}
                     onClick={() => { favoriteKeyword({ keywordID: ID, sticky: !sticky }); setShowOptions(false); }}>
                        <span className=' bg-yellow-300/30 text-yellow-500 px-1 rounded'>
                           <Icon type="star" size={14} />
                        </span> { sticky ? 'Quitar de favoritas' : 'Marcar favorita'}
                     </a>
                  </li>}
                  {canManage && <li><a className={optionsButtonStyle} onClick={() => { manageTags(); setShowOptions(false); }}>
                     <span className=' bg-green-100 text-green-500 px-1 rounded'><Icon type="tags" size={14} /></span> Editar etiquetas</a>
                  </li>}
                  {canManage && manageScrape && <li><a className={optionsButtonStyle} onClick={() => { manageScrape(); setShowOptions(false); }}>
                     <span className=' bg-slate-100 text-slate-500 px-1 rounded'><Icon type="search" size={14} /></span> Profundidad de búsqueda</a>
                  </li>}
                  {canManage && manageTarget && <li><a className={optionsButtonStyle} onClick={() => { manageTarget(); setShowOptions(false); }}>
                     <span className=' bg-indigo-100 text-indigo-600 px-1 rounded not-italic text-xs'>🎯</span> URL objetivo</a>
                  </li>}
                  {canManage && <li><a className={optionsButtonStyle} onClick={() => { removeKeyword([ID]); setShowOptions(false); }}>
                     <span className=' bg-red-100 text-red-600 px-1 rounded'><Icon type="trash" size={14} /></span> Quitar keyword</a>
                  </li>}
                  <li><a className={optionsButtonStyle} onClick={() => { showKeywordDetails(); setShowOptions(false); }}>
                     <span className=' bg-slate-100 text-slate-500 px-1 rounded'><Icon type="eye" size={14} /></span> Ver historial</a>
                  </li>
               </ul>
            )}
         </div>

         {lastUpdateError && lastUpdateError.date && showPositionError && (
            <div className={`absolute p-2 bg-surface z-30 border border-red-200 rounded w-[240px] left-4 shadow-sm text-xs
            ${index > 2 ? 'lg:bottom-12 mt-[-70px]' : ' top-12'}`}>
               Error al actualizar la posición (intentado <TimeAgo
                                                         formatter={timeAgoFormatter}
                                                         title={dayjs(lastUpdateError.date).format('DD-MMM-YYYY, HH:mm')}
                                                         date={lastUpdateError.date} />)
               <i className='absolute top-0 right-0 ml-2 p-2 font-semibold not-italic cursor-pointer' onClick={() => setPositionError(false)}>
                  <Icon type="close" size={16} color='currentColor' />
               </i>
               <div className=' border-t-[1px] border-red-100 mt-2 pt-1'>
                  {lastUpdateError.scraper && <strong className='capitalize'>{lastUpdateError.scraper}: </strong>}{lastUpdateError.error}
               </div>
            </div>
         )}
      </div>
   );
 };

 export default Keyword;
