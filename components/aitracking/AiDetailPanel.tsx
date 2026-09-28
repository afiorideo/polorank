import React from 'react';
import SidePanel from '../common/SidePanel';
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
                        <h4 className='text-[11px] uppercase tracking-wide text-gray-400 mb-2'>Lo que responde Google</h4>
                        <p className='text-gray-600 leading-relaxed bg-slate-50 rounded p-3 text-[13px]'>
                           {row.text.replace(/\[\[\d+\]\]\([^)]*\)/g, '').slice(0, 600)}
                        </p>
                     </div>
                  )}

                  <h4 className='text-[11px] uppercase tracking-wide text-gray-400 mb-2'>
                     Quién está citado ({row.references.length})
                  </h4>
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
                              {esMio && <span className='text-[11px] text-emerald-700 shrink-0'>sos vos</span>}
                           </li>
                        );
                     })}
                  </ul>

                  {row.cited === 0 && (
                     <p className='mt-4 px-3 py-2 rounded bg-rose-50 text-rose-700 text-xs'>
                        {domain} no aparece entre las fuentes de este resumen.
                     </p>
                  )}
               </>
            )}
         </div>
      </SidePanel>
   );
};

export default AiDetailPanel;
