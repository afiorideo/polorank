import React from 'react';
import SidePanel from '../common/SidePanel';
import AiSummaryText from './AiSummaryText';
import type { AiTrackingRow } from '../../services/aiTracking';

type AiDetailPanelProps = {
   row: AiTrackingRow,
   domain: string,
   closePanel: () => void,
}

const norm = (d: string): string => (d || '').replace(/^https?:\/\//, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();

/**
 * PoloRank — quién está citado en el resumen con IA de una búsqueda.
 *
 * Es el equivalente al panel que muestra la SERP completa, pero para la respuesta de la IA: el texto que
 * escribió Google y la lista de fuentes que usó, marcando cuál es del dominio propio.
 */
const AiDetailPanel = ({ row, domain, closePanel }: AiDetailPanelProps) => {
   const mine = norm(domain);
   return (
      <SidePanel title={row.keyword} closePanel={closePanel} width='medium'>
         <div className='p-6 text-sm'>
            <p className='text-xs text-gray-400 mb-5'>
               {row.volume ? `${row.volume} búsquedas/mes` : 'sin volumen conocido'}
               {row.lastDate ? ` · último dato: ${row.lastDate}` : ''}
            </p>

            {row.cited === -1 && (
               <div className='p-4 rounded bg-slate-50 text-gray-600'>
                  Google no respondió con IA para esta búsqueda en la última medición.
                  <span className='block text-xs text-gray-400 mt-1'>No es que no te citen: no hubo resumen que citara a nadie.</span>
               </div>
            )}

            {row.cited !== -1 && (
               <>
                  {row.text && (
                     <div className='mb-6'>
                        <h4 className='text-[11px] uppercase tracking-wide text-gray-400 mb-2'>
                           Lo que responde Google
                           <span className='ml-2 normal-case tracking-normal text-gray-300'>· las etiquetas son sus fuentes</span>
                        </h4>
                        <div className='bg-slate-50 rounded p-3'>
                           <AiSummaryText text={row.text} domain={domain} sources={row.references} />
                        </div>
                     </div>
                  )}

                  <h4 className='text-[11px] uppercase tracking-wide text-gray-400 mb-1'>
                     Quién aparece ({row.references.length})
                  </h4>
                  <div className='flex text-[10px] uppercase tracking-wide text-gray-400 px-3 pb-1'>
                     <span className='flex-1'>fuente</span>
                     <span className='w-12 text-center'>cita</span>
                     <span className='w-14 text-center'>nombre</span>
                  </div>
                  <ul className='flex flex-col gap-1'>
                     {row.references.map((r) => {
                        const esMio = norm(r.domain) === mine;
                        return (
                           <li
                           key={`${r.position}-${r.domain}`}
                           className={`flex items-baseline gap-3 px-3 py-2 rounded ${esMio ? 'bg-emerald-50' : ''}`}>
                              <span className='text-xs text-gray-400 tabular-nums w-4'>{r.position}</span>
                              <span className={`flex-1 min-w-0 ${esMio ? 'font-semibold text-emerald-700' : 'text-gray-600'}`}>
                                 {r.source || r.domain}
                                 <a
                                 href={r.url}
                                 target='_blank'
                                 rel='noreferrer'
                                 className='block text-[11px] text-gray-400 truncate hover:text-indigo-600'
                                 onClick={(e) => e.stopPropagation()}>
                                    {r.domain}
                                 </a>
                              </span>
                              <span className='w-12 text-center shrink-0 text-emerald-600' title='Citada como fuente'>✓</span>
                              <span
                              className={`w-14 text-center shrink-0 ${r.mentioned ? 'text-emerald-600' : 'text-gray-300'}`}
                              title={r.mentioned ? 'El texto la nombra' : 'El texto no la nombra'}>
                                 {r.mentioned ? '✓' : '✗'}
                              </span>
                           </li>
                        );
                     })}
                  </ul>

                  {row.cited === 0 && (
                     <p className='mt-4 px-3 py-2 rounded bg-rose-50 text-rose-700 text-xs'>
                        {domain} no aparece entre las fuentes
                        {row.mentioned === 1
                           ? ', pero el texto sí nombra tu marca: Google te conoce y manda el clic a otro.'
                           : ' ni el texto nombra tu marca.'}
                     </p>
                  )}
                  {row.cited === 1 && row.mentioned === 0 && (
                     <p className='mt-4 px-3 py-2 rounded bg-amber-50 text-amber-700 text-xs'>
                        Te cita como fuente pero no te nombra: aportás el contenido y el lector no se entera de quién sos.
                     </p>
                  )}
               </>
            )}
         </div>
      </SidePanel>
   );
};

export default AiDetailPanel;
