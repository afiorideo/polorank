import React from 'react';
import Icon from '../common/Icon';
import DonutScore from './DonutScore';
import { useRunAudit } from '../../services/audit';
import type { AuditRunSummary } from '../../services/audit';
import { BLOCK_LABELS, BLOCKS } from '../../utils/audit/engine';

type AuditPanelProps = {
   domain: DomainType | null,
   run?: AuditRunSummary,
   canRun?: boolean,
}

const fecha = (iso: string | null): string => (iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/**
 * PoloRank — the audit of one site: one donut per block, each with its two numbers.
 * Before the first run it says so plainly instead of drawing a score out of nothing.
 */
const AuditPanel = ({ domain, run, canRun = false }: AuditPanelProps) => {
   const { mutate: runAudit, isLoading } = useRunAudit();
   if (!domain) { return <div className='w-full h-40' />; }

   const byBlock = new Map((run?.blocks || []).map((b) => [b.block, b]));

   return (
      <div className='audit_panel w-full mt-4'>
         <div className='flex items-center justify-between flex-wrap gap-3 mb-4'>
            <p className='text-xs text-gray-500'>
               {run
                  ? `Última auditoría: ${fecha(run.finishedAt || run.startedAt)} · ${run.pagesCrawled} páginas`
                    + ` · ${(run.durationMs / 1000).toFixed(1)}s`
                  : 'Este sitio todavía no fue auditado.'}
               {run?.status === 'partial' && <span className='ml-2 text-amber-600'>corrida acortada por el límite de páginas</span>}
            </p>
            {canRun && (
               <button
               className='text-sm px-4 py-2 rounded bg-indigo-50 text-blue-700 border border-indigo-100
               hover:bg-blue-700 hover:text-white transition disabled:opacity-50'
               disabled={isLoading}
               onClick={() => runAudit(domain.domain)}>
                  <Icon type={isLoading ? 'loading' : 'reload'} size={isLoading ? 16 : 12} /> {isLoading ? 'Auditando…' : 'Auditar ahora'}
               </button>
            )}
         </div>

         {run ? (
            <div className='grid gap-3' style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
               {BLOCKS.map((block) => {
                  const b = byBlock.get(block);
                  return <DonutScore
                     key={block}
                     label={BLOCK_LABELS[block]}
                     compliance={b?.compliance || 0}
                     coverage={b?.coverage || 0}
                     weight={b?.weight}
                     cappedBy={b?.cappedBy || ''}
                     checksMeasured={b?.checksMeasured || 0}
                     checksTotal={b?.checksTotal || 0}
                     />;
               })}
            </div>
         ) : (
            <div className='px-6 py-14 text-center bg-surface rounded-md border'>
               <span className='inline-block text-indigo-300 mb-4'><Icon type='research' size={38} color='currentColor' /></span>
               <h3 className='font-semibold text-gray-700 mb-2'>Todavía no hay auditorías de {domain.domain}</h3>
               <p className='text-sm text-gray-500 max-w-[480px] mx-auto leading-relaxed'>
                  La auditoría recorre el sitio y revisa cada página. Recién después de la primera corrida hay algo que mostrar.
               </p>
            </div>
         )}

         {run && (
            <p className='text-[11px] text-gray-400 mt-4 leading-relaxed'>
               El número grande es <strong>cumplimiento</strong>: qué proporción pasó, sobre lo que se pudo medir.
               La barra de abajo es <strong>cobertura</strong>: cuánto del bloque se evaluó. Un bloque en 100% con
               cobertura 50% aprobó todo lo que miró… y miró la mitad.
            </p>
         )}
      </div>
   );
};

export default AuditPanel;
