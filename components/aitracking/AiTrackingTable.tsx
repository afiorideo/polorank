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

/** `18/22` = te citaron 18 de las 22 veces que hubo resumen. `—` = no hubo ninguna oportunidad. */
const ratio = (r: CitationRatio): string => (r ? `${r.cited}/${r.chances}` : '—');

const ratioTitle = (r: CitationRatio): string => (r
   ? `Te citaron ${r.cited} de las ${r.chances} veces que Google respondió con IA en ese período`
   : 'Google no respondió con IA ninguna vez en ese período');

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
   // La keyword se queda con el ancho sobrante; el resto va en columnas angostas y pegadas entre sí:
   // ninguna lleva más de 5 o 6 caracteres, y separarlas hacía que la fila se leyera como cinco tablas.
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

   const conResumen = rows.filter((r) => r.cited !== -1).length;

   return (
      <>
         <p className='text-xs text-gray-500 mb-3'>
            {conResumen === 0
               ? 'Todavía no hay mediciones de IA. La primera llega con el próximo chequeo de posiciones.'
               : `${rows.filter((r) => r.cited === 1).length} de ${conResumen} búsquedas con resumen te citan.`}
         </p>
         <div className='overflow-x-auto border rounded-md bg-surface'>
            <table className='w-full text-sm' style={{ minWidth: 700 }}>
               <thead>
                  <tr className='text-left border-b'>
                     <th className={`${th} pl-3 w-full`}>Keyword</th>
                     <th className={`${th} text-right w-[58px]`}>Vol.</th>
                     <th className={`${th} w-[76px]`}>¿Te cita?</th>
                     <th className={`${th} text-right w-[52px]`}>Puesto</th>
                     <th className={`${th} w-[150px]`}>URL citada</th>
                     <th className={`${th} text-right w-[46px]`}>7d</th>
                     <th className={`${th} text-right w-[46px]`}>30d</th>
                     <th className={`${th} text-right w-[46px]`}>60d</th>
                     <th className={`${th} text-right pr-3 w-[46px]`}>90d</th>
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
                        </td>
                        <td className={`${td} text-right text-gray-500 tabular-nums`}>{r.volume || '—'}</td>
                        <td className={td}><AiCitedBadge cited={r.cited} /></td>
                        <td className={`${td} text-right tabular-nums text-gray-600`}>{r.position || '—'}</td>
                        <td className={`${td} text-xs text-gray-500 max-w-[150px] truncate`} title={r.citedUrl}>
                           {shortUrl(r.citedUrl, domain)}
                        </td>
                        {(['d7', 'd30', 'd60', 'd90'] as const).map((p) => (
                           <td
                           key={p}
                           className={`${td} text-right text-xs text-gray-500 tabular-nums ${p === 'd90' ? 'pr-3' : ''}`}
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
            Los períodos cuentan <strong>oportunidades</strong>, no días: <code>18/22</code> significa que hubo resumen 22
            veces y te citaron en 18. <strong>N/A</strong> no es que no te citen — es que Google no respondió con IA.
         </p>
         {selected && <AiDetailPanel row={selected} domain={domain} closePanel={() => setSelected(null)} />}
      </>
   );
};

export default AiTrackingTable;
