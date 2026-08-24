import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import Icon from '../common/Icon';
import countries from '../../utils/countries';
import Chart from '../common/Chart';
import KeywordPosition from './KeywordPosition';
import PositionChange from './PositionChange';
import SerpFeatures from './SerpFeatures';
import { useFetchSingleKeyword } from '../../services/keywords';
import useOnKey from '../../hooks/useOnKey';
import { averagePosition, bestPosition, chartSeries, historyPoints, monthlySummary, rangeChange, resultsReceived } from '../../utils/history';

type KeywordDetailsProps = {
   keyword: KeywordType,
   closeDetails: Function,
   /** PoloRank: navigate to the previous / next keyword of the current view without closing the panel */
   onPrev?: () => void,
   onNext?: () => void,
}

type ResultSegment = { type: 'result', item: KeywordLastResult } | { type: 'skipped', from: number, to: number };

const RANGES = [
   { label: '30 días', value: '30' },
   { label: '90 días', value: '90' },
   { label: '6 meses', value: '180' },
   { label: '12 meses', value: '365' },
   { label: 'Todo', value: 'all' },
];

const KeywordDetails = ({ keyword, closeDetails, onPrev, onNext }:KeywordDetailsProps) => {
   const updatedDate = new Date(keyword.lastUpdated);
   const [range, setRange] = useState<string>('180');
   const searchResultContainer = useRef<HTMLDivElement>(null);
   const searchResultFound = useRef<HTMLDivElement>(null);
   const { data: keywordData, isLoading } = useFetchSingleKeyword(keyword.ID);
   const keywordHistory: KeywordHistory = keywordData?.history || keyword.history;
   const keywordSearchResult: KeywordLastResult[] = useMemo(
      () => keywordData?.searchResult || keyword.lastResult || [],
      [keywordData, keyword.lastResult],
   );

   useOnKey('Escape', closeDetails);
   useOnKey('ArrowLeft', () => { if (onPrev) onPrev(); });
   useOnKey('ArrowRight', () => { if (onNext) onNext(); });

   useLayoutEffect(() => {
      if (keyword.position < 100 && keyword.position > 0 && searchResultFound?.current) {
         searchResultFound.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'start' });
      }
   }, [keywordSearchResult, keyword.position]);

   const chartData = useMemo(() => chartSeries(keywordHistory, range === 'all' ? 'all' : parseInt(range, 10)), [keywordHistory, range]);

   // KPIs for the selected range
   const rangeDays = range === 'all' ? 3650 : parseInt(range, 10);
   const best = useMemo(() => bestPosition(keywordHistory), [keywordHistory]);
   const avg = useMemo(() => averagePosition(keywordHistory, rangeDays), [keywordHistory, rangeDays]);
   const periodChange = useMemo(
      () => rangeChange(keywordHistory, keyword.position, range === 'all' ? 'all' : rangeDays),
      [keywordHistory, keyword.position, range, rangeDays],
   );
   const months = useMemo(() => monthlySummary(keywordHistory), [keywordHistory]);
   const received = useMemo(() => resultsReceived(keywordSearchResult), [keywordSearchResult]);
   const daysTracked = historyPoints(keywordHistory).length;

   // SERP result segments (consecutive skipped positions grouped)
   const { skippedCount, resultSegments } = useMemo(() => {
      const results = Array.isArray(keywordSearchResult) ? keywordSearchResult : [];
      const skipped = results.filter((r) => r.skipped).length;
      const segs: ResultSegment[] = [];
      let skippedStart: number | null = null;
      let skippedEnd: number = 0;
      for (let i = 0; i < results.length; i += 1) {
         const item = results[i];
         if (item.skipped) {
            if (skippedStart === null) { skippedStart = item.position; }
            skippedEnd = item.position;
         } else {
            if (skippedStart !== null) { segs.push({ type: 'skipped', from: skippedStart, to: skippedEnd }); skippedStart = null; }
            segs.push({ type: 'result', item });
         }
      }
      if (skippedStart !== null) { segs.push({ type: 'skipped', from: skippedStart, to: skippedEnd }); }
      return { skippedCount: skipped, resultSegments: segs };
   }, [keywordSearchResult]);

   const closeOnBGClick = (e:React.SyntheticEvent) => {
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      if (e.target === e.currentTarget) { closeDetails(); }
   };

   const kpi = 'flex-1 min-w-[110px] rounded-lg border border-slate-200 bg-surface px-3 py-2';
   const kpiLabel = 'block text-[10px] uppercase tracking-wide text-gray-400 font-semibold';
   const kpiValue = 'block text-xl font-bold text-slate-700';
   const navBtn = 'px-2 py-1 rounded border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200'
      + ' disabled:opacity-30 disabled:cursor-not-allowed';

   return (
       <div className="keywordDetails fixed w-full h-screen top-0 left-0 z-[99999]" onClick={closeOnBGClick} data-testid="keywordDetails">
            <div className="keywordDetails absolute w-full lg:w-6/12 xl:w-5/12 bg-bg customShadow top-0 right-0 h-screen flex flex-col" >
               <div className='keywordDetails__header p-5 pr-24 border-b border-b-slate-200 bg-surface text-slate-600'>
                  <h3 className='text-lg font-bold flex items-center flex-wrap gap-2'>
                     <span title={countries[keyword.country] && countries[keyword.country][0]}
                     className={`fflag fflag-${keyword.country} w-[18px] h-[12px]`} />
                     <span>{keyword.keyword}{keyword.city ? ` (${keyword.city})` : ''}</span>
                     <KeywordPosition position={keyword.position} badge resultsReceived={received} lastDepth={keyword.lastDepth} />
                  </h3>
                  <p className='text-xs text-gray-400 mt-1'>
                     {keyword.device === 'mobile' ? 'Mobile' : 'Desktop'} · {keyword.domain}
                     {' · '}agregada el {dayjs(keyword.added).format('DD-MMM-YYYY')}
                     {' · '}{daysTracked} día{daysTracked === 1 ? '' : 's'} con datos
                     {keyword.url && (
                        <>
                           {' · '}URL actual:{' '}
                           <a className='text-indigo-500 hover:underline' href={keyword.url} target='_blank' rel='noreferrer'>
                              {keyword.url.replace(/^https?:\/\/(www\.)?/, '')}
                           </a>
                        </>
                     )}
                  </p>
                  <div className='absolute top-3 right-3 flex items-center gap-1'>
                     <button className={navBtn} title='Anterior (←)' disabled={!onPrev} onClick={() => onPrev && onPrev()}>
                        <Icon type='caret-left' size={14} />
                     </button>
                     <button className={navBtn} title='Siguiente (→)' disabled={!onNext} onClick={() => onNext && onNext()}>
                        <Icon type='caret-right' size={14} />
                     </button>
                     <button
                     className='p-2 px-3 text-gray-400 hover:text-gray-700 transition-all hover:rotate-90'
                     onClick={() => closeDetails()} title='Cerrar (Esc)'>
                        <Icon type='close' size={24} />
                     </button>
                  </div>
               </div>
               <div className='keywordDetails__content p-5 overflow-y-auto styled-scrollbar flex-1'>

                  <div className='keywordDetails__section'>
                     <div className="keywordDetails__section__head flex justify-between items-center mb-3">
                        <h3 className=' font-bold text-gray-700'>Historial de posición</h3>
                        <div className='inline-flex rounded-full border border-gray-200 bg-surface overflow-hidden text-xs'
                        data-testid='range_selector'>
                           {RANGES.map((r) => (
                              <span key={r.value}
                                 className={`px-3 py-1.5 cursor-pointer select-none
                                 ${range === r.value ? 'bg-blue-700 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                                 onClick={() => setRange(r.value)}>{r.label}</span>
                           ))}
                        </div>
                     </div>
                     <div className='flex flex-wrap gap-2 mb-3' data-testid='kpis'>
                        <div className={kpi}><span className={kpiLabel}>Hoy</span>
                           <span className={kpiValue}>{keyword.position > 0 ? keyword.position : '—'}</span></div>
                        <div className={kpi}><span className={kpiLabel}>Mejor</span>
                           <span className={kpiValue}>{best ? best.position : '—'}</span>
                           {best && <span className='text-[11px] text-gray-400'>{dayjs(best.date).format('DD-MMM-YYYY')}</span>}</div>
                        <div className={kpi}>
                           <span className={kpiLabel}>Promedio {range === 'all' ? 'total' : RANGES.find((r) => r.value === range)?.label}</span>
                           <span className={kpiValue}>{avg !== null ? avg : '—'}</span>
                        </div>
                        <div className={kpi}>
                           <span className={kpiLabel}>Cambio en el período</span>
                           <span className={`${kpiValue}`}><PositionChange change={periodChange} arrow /></span>
                           {periodChange.position !== null && (
                              <span className='text-[11px] text-gray-400'>
                                 desde {periodChange.position === 0 ? 'fuera del top' : `pos. ${periodChange.position}`}
                              </span>
                           )}
                        </div>
                     </div>
                     <div className='keywordDetails__section__chart h-56 bg-surface rounded-lg border border-slate-200 p-2'>
                        {isLoading && !keywordData && <p className='text-xs text-gray-400 p-4'>Cargando historial completo…</p>}
                        {chartData.labels.length > 0 && <Chart labels={chartData.labels} series={chartData.series} noMaxLimit />}
                     </div>
                  </div>

                  <div className='keywordDetails__section mt-6'>
                     <h3 className='font-bold text-gray-700 mb-2'>Por mes</h3>
                     {months.length === 0 && <p className='text-xs text-gray-400'>Todavía no hay historial suficiente.</p>}
                     {months.length > 0 && (
                        <div className='bg-surface rounded-lg border border-slate-200 overflow-x-auto'>
                           <table className='w-full text-sm' data-testid='monthly_table'>
                              <thead>
                                 <tr className='text-left text-[10px] uppercase tracking-wide text-gray-400 border-b border-slate-100'>
                                    <th className='py-2 px-3'>Mes</th>
                                    <th className='py-2 px-2 text-center'>Mejor</th>
                                    <th className='py-2 px-2 text-center'>Promedio</th>
                                    <th className='py-2 px-2 text-center'>Peor</th>
                                    <th className='py-2 px-2 text-center' title='Cambio del promedio vs. el mes anterior'>Cambio</th>
                                    <th className='py-2 px-2 text-center' title='Días con datos (días sin aparecer)'>Días</th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {months.map((m) => (
                                    <tr key={m.month} className='border-b border-slate-50 last:border-0'>
                                       <td className='py-2 px-3 font-semibold text-slate-600 whitespace-nowrap'>{m.label}</td>
                                       <td className='py-2 px-2 text-center'>
                                          {m.best !== null ? <KeywordPosition position={m.best} badge /> : '—'}
                                       </td>
                                       <td className='py-2 px-2 text-center text-slate-600'>{m.avg !== null ? m.avg : '—'}</td>
                                       <td className='py-2 px-2 text-center text-slate-500'>{m.worst !== null ? m.worst : '—'}</td>
                                       <td className='py-2 px-2 text-center'>
                                          <PositionChange change={{ change: m.change, position: null }} arrow />
                                       </td>
                                       <td className='py-2 px-2 text-center text-xs text-gray-400'>
                                          {m.days}{m.notFoundDays > 0 ? ` (${m.notFoundDays} sin aparecer)` : ''}
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     )}
                  </div>

                  <div className='keywordDetails__section mt-6'>
                     <div className="keywordDetails__section__head flex justify-between items-center pb-2 mb-3 border-b border-b-slate-200">
                        <h3 className=' font-bold text-gray-700'>Resultados de Google
                           <a className='text-gray-400 hover:text-indigo-600 inline-block ml-1 px-2 py-1'
                              href={`https://www.google.com/search?q=${encodeURI(keyword.keyword)}`}
                              target="_blank"
                              rel='noreferrer' title='Abrir en Google'>
                              <Icon type='link' size={14} />
                           </a>
                        </h3>
                        <span className=' text-xs text-gray-500'>{dayjs(updatedDate).format('DD-MMM-YYYY HH:mm')}</span>
                     </div>
                     {(keyword.serpFeatures && keyword.serpFeatures.length > 0) && (
                        <div className='mb-3 text-xs text-gray-500 flex items-center gap-2'>
                           <span>Bloques en la SERP:</span><SerpFeatures features={keyword.serpFeatures} showAll size='md' />
                        </div>
                     )}
                     {skippedCount > 0 && (
                        <div className='mb-3 p-2 rounded bg-blue-50 border border-blue-100 text-xs text-blue-600'>
                           Se revisaron los primeros {keyword.lastDepth || received} resultados (estrategia de páginas del dominio)
                           {received !== (keyword.lastDepth || received) ? ` · Google devolvió ${received} orgánicos` : ''}
                        </div>
                     )}
                     <div className='keywordDetails__section__results' ref={searchResultContainer}>
                        {resultSegments.length === 0 && <p className='text-xs text-gray-400'>Sin resultados guardados todavía.</p>}
                        {resultSegments.map((seg) => {
                           if (seg.type === 'skipped') {
                              const count = seg.to - seg.from + 1;
                              return (
                                 <div key={`skipped-${seg.from}`}
                                 className={'leading-6 mb-2 px-3 py-1 text-xs rounded bg-gray-50 border border-dashed border-gray-200 text-gray-400'
                                    + ' italic'}>
                                    Posiciones {seg.from}–{seg.to}: {count} no consultadas
                                 </div>
                              );
                           }
                           const { position } = keyword;
                           const domainExist = position > 0 && seg.item.position === position;
                           return (
                              <div
                              ref={domainExist ? searchResultFound : null}
                              className={`leading-5 mb-2 p-2 text-sm break-all rounded bg-surface border
                              ${domainExist ? 'border-amber-300 bg-amber-50' : 'border-slate-100'}`}
                              key={seg.item.url + seg.item.position}>
                                 <h4 className='font-semibold text-blue-700 text-[13px]'>
                                    <a href={seg.item.url} target="_blank" rel='noreferrer'>{`${seg.item.position}. ${seg.item.title}`}</a>
                                 </h4>
                                 <a className='text-green-800 text-xs' href={seg.item.url} target="_blank" rel='noreferrer'>{seg.item.url}</a>
                              </div>
                           );
                        })}
                     </div>
                  </div>
               </div>
            </div>
       </div>
   );
};

export default KeywordDetails;
