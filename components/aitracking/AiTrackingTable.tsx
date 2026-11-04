import React, { useState } from 'react';
import AiCitedBadge from './AiCitedBadge';
import AiDetailPanel from './AiDetailPanel';
import Icon from '../common/Icon';
import type { AiTrackingRow, CitationRatio } from '../../services/aiTracking';

type AiTrackingTableProps = {
   rows: AiTrackingRow[],
   domain: string,
   isLoading: boolean,
}

/** `3/4` = te citó 3 de las 4 semanas con resumen. `—` = la serie no cubre el período. */
const ratio = (r: CitationRatio): string => (r ? `${r.cited}/${r.withAi}` : '—');

const ratioTitle = (r: CitationRatio): string => (r
   ? `Te citó ${r.cited} de las ${r.withAi} semanas con resumen.`
   : 'Todavía no hay mediciones que cubran ese período');

const shortUrl = (url: string, domain: string): string => {
   if (!url) { return '—'; }
   return url.replace(/^https?:\/\/(www\.)?/, '').replace(domain, '') || '/';
};

/**
 * PoloRank — Tracking IA: espejo de la tabla de Tracking, pero midiendo si Google cita al dominio en su
 * resumen con IA. Solo lectura: el alta y la edición de keywords siguen en Tracking.
 */
const AiTrackingTable = ({ rows, domain, isLoading }: AiTrackingTableProps) => {
   const [selected, setSelected] = useState<AiTrackingRow | null>(null);
   // Las columnas de dato llevan ancho fijo (ninguna pasa de 6 caracteres) y Keyword se queda con el resto,
   // pero la tabla está topada a 880 px. Sin ese tope, en un monitor ancho el sobrante iba entero a Keyword
   // —el resto suma apenas ~520 px— y quedaba media pantalla en blanco entre la keyword y el volumen.
   const th = 'py-2.5 px-2 font-medium text-[11px] uppercase tracking-wide text-gray-400 whitespace-nowrap';
   const td = 'py-3 px-2';

   if (isLoading) {
      return <div className='mt-4 p-5 py-12 rounded border text-center bg-surface text-sm'><Icon type='loading' /> Cargando…</div>;
   }
   if (rows.length === 0) {
      return (
         <div className='mt-4 p-5 py-12 rounded border text-center bg-surface text-sm text-gray-500'>
            No hay keywords en este dominio. Se agregan desde la pestaña Tracking.
         </div>
      );
   }

   const conResumen = rows.filter((r) => r.cited >= 0 || r.cited === -2).length;

   return (
      <>
         <p className='text-xs text-gray-500 mb-3'>
            {conResumen === 0
               ? 'Todavía no hay mediciones de IA. La primera llega con el próximo chequeo de posiciones.'
               : `${rows.filter((r) => r.cited === 1).length} de ${conResumen} búsquedas con resumen te citan.`}
         </p>
         <div className='overflow-x-auto border rounded-md bg-surface inline-block max-w-full align-top'>
            <table className='w-full text-sm' style={{ minWidth: 800, maxWidth: 940 }}>
               <thead>
                  <tr className='text-left border-b'>
                     <th className={`${th} pl-3`}>Keyword</th>
                     <th className={`${th} text-right w-[58px]`}>Vol.</th>
                     <th className={`${th} w-[70px]`}>¿Te cita?</th>
                     <th className={`${th} w-[80px]`}>¿Te nombra?</th>
                     <th className={`${th} text-right w-[52px]`}>Puesto</th>
                     <th className={`${th} text-right w-[60px]`}>Local Pack</th>
                     <th className={`${th} w-[150px]`}>URL citada</th>
                     <th className={`${th} text-right w-[56px]`}>4 sem</th>
                     <th className={`${th} text-right w-[56px]`}>8 sem</th>
                     <th className={`${th} text-right pr-3 w-[56px]`}>12 sem</th>
                  </tr>
               </thead>
               <tbody>
                  {rows.map((r) => (
                     <tr
                     key={r.keywordID}
                     className='border-b last:border-0 hover:bg-indigo-50 cursor-pointer'
                     onClick={() => setSelected(r)}>
                        <td className={`${td} pl-3 font-semibold text-gray-700`}>
                           <span className={`fflag fflag-${r.country} w-[18px] h-[12px] mr-2 inline-block align-middle`} />
                           {r.keyword}
                           {!r.trusted && (
                              <span
                              className='ml-2 inline-block text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 align-middle'
                              title='La página de Google de esta semana vino alterada (no coincide con Serper). No cuenta en las tasas.'>
                                 no confiable
                              </span>
                           )}
                        </td>
                        <td className={`${td} text-right text-gray-500 tabular-nums`}>{r.volume || '—'}</td>
                        <td className={td}><AiCitedBadge cited={r.cited} /></td>
                        <td className={td}><AiCitedBadge cited={r.mentioned} kind='mention' /></td>
                        <td className={`${td} text-right tabular-nums text-gray-600`}>{r.position || '—'}</td>
                        <td className={`${td} text-right tabular-nums text-gray-600`}>
                           {r.localPack?.present && r.localPack.position ? `#${r.localPack.position}` : '—'}
                        </td>
                        <td className={`${td} text-xs text-gray-500 max-w-[150px] truncate`} title={r.citedUrl}>
                           {shortUrl(r.citedUrl, domain)}
                        </td>
                        {(['w4', 'w8', 'w12'] as const).map((p) => (
                           <td
                           key={p}
                           className={`${td} text-right text-xs text-gray-500 tabular-nums ${p === 'w12' ? 'pr-3' : ''}`}
                           title={ratioTitle(r.periods[p])}>
                              {ratio(r.periods[p])}
                           </td>
                        ))}
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
         <p className='text-[11px] text-gray-400 mt-2'>
            <strong>Te cita</strong> = tu sitio aparece como fuente del resumen. <strong>Te nombra</strong> = el texto
            escribe tu marca; la etiqueta de la cita no cuenta, tiene que estar en la redacción.
            Los períodos se cuentan en <strong>semanas</strong>: <code>3/4</code>
            significa que te citó 3 de las 4 semanas en que hubo resumen, y muestran <code>—</code> hasta que haya
            mediciones de esa antigüedad. Las semanas con página <strong>no confiable</strong> no cuentan.
            <strong> N/A</strong> no es que no aparezcas: es que Google no respondió
            con IA en esa búsqueda.
         </p>
         {selected && <AiDetailPanel row={selected} domain={domain} closePanel={() => setSelected(null)} />}
      </>
   );
};

export default AiTrackingTable;
