import React, { useMemo, useState } from 'react';
import { BLOCK_LABELS } from '../../utils/audit/engine';
import type { AuditCheckRow, AuditCatalogEntry } from '../../services/audit';

type AuditChecksProps = {
   checks: AuditCheckRow[],
   catalog: AuditCatalogEntry[],
   domain: string,
   /** Block to show first, when the user arrives by clicking a donut. */
   block: string,
   onBlock: (block: string) => void,
}

const PILL: Record<string, { label: string, className: string }> = {
   fail: { label: 'Falla', className: 'bg-red-50 text-red-700' },
   partial: { label: 'Parcial', className: 'bg-amber-50 text-amber-700' },
   pass: { label: 'Pasa', className: 'bg-emerald-50 text-emerald-700' },
   na: { label: 'No medible', className: 'bg-gray-100 text-gray-500' },
   pending_review: { label: 'Revisión', className: 'bg-indigo-50 text-indigo-600' },
};

const shortUrl = (url: string, domain: string): string => {
   if (!url) { return '(todo el sitio)'; }
   return url.replace(/^https?:\/\/(www\.)?/, '').replace(domain, '') || '/';
};

/** Evidence rendered as `clave: valor`, which is what makes a verdict arguable instead of a decree. */
const evidenceText = (evidence: Record<string, unknown>): string => Object.entries(evidence)
   .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
   .join(' · ');

/**
 * PoloRank — the verdicts of one audit, worst first.
 * "No medible" is shown but never counted as a failure: that distinction is the whole difference between this
 * and a checklist that paints a red circle every time a fetch fails.
 */
const AuditChecks = ({ checks, catalog, domain, block, onBlock }: AuditChecksProps) => {
   const [onlyProblems, setOnlyProblems] = useState(true);
   const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);

   const blocks = useMemo(() => {
      const counts = new Map<string, number>();
      checks.forEach((c) => counts.set(c.block, (counts.get(c.block) || 0) + (c.status === 'fail' ? 1 : 0)));
      return [...new Set(checks.map((c) => c.block))].map((b) => ({ block: b, fails: counts.get(b) || 0 }));
   }, [checks]);

   const visible = useMemo(() => checks
      .filter((c) => (block ? c.block === block : true))
      .filter((c) => (onlyProblems ? c.status === 'fail' || c.status === 'partial' : true)),
   [checks, block, onlyProblems]);

   const tabStyle = (on: boolean): string => (on
      ? 'text-xs px-2.5 py-1 rounded border bg-indigo-50 text-blue-700 border-indigo-200'
      : 'text-xs px-2.5 py-1 rounded border text-gray-500 border-transparent');

   if (checks.length === 0) { return null; }

   return (
      <div className='audit_checks mt-8'>
         <div className='flex items-center justify-between flex-wrap gap-3 mb-3'>
            <div className='flex gap-1 flex-wrap'>
               <button className={tabStyle(block === '')} onClick={() => onBlock('')}>Todos</button>
               {blocks.map(({ block: b, fails }) => (
                  <button key={b} className={tabStyle(block === b)} onClick={() => onBlock(b)}>
                     {BLOCK_LABELS[b] || b}{fails > 0 && <span className='ml-1 text-red-600'>{fails}</span>}
                  </button>
               ))}
            </div>
            <label className='text-xs text-gray-500 cursor-pointer select-none'>
               <input type='checkbox' className='mr-1.5 align-middle' checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
               Solo lo que falla
            </label>
         </div>

         <div className='overflow-x-auto border rounded-md bg-surface'>
            <table className='w-full text-sm' style={{ minWidth: 640 }}>
               <thead>
                  <tr className='text-left text-[11px] uppercase tracking-wide text-gray-400 border-b'>
                     <th className='px-4 py-2.5 font-medium'>Verificación</th>
                     <th className='px-4 py-2.5 font-medium'>Estado</th>
                     <th className='px-4 py-2.5 font-medium'>Página</th>
                     <th className='px-4 py-2.5 font-medium'>Evidencia</th>
                     <th className='px-4 py-2.5 font-medium text-right'>Peso</th>
                  </tr>
               </thead>
               <tbody>
                  {visible.map((c, i) => {
                     const def = byId.get(c.checkId);
                     const pill = PILL[c.status] || PILL.na;
                     return (
                        <tr key={`${c.checkId}-${c.url}-${i}`} className='border-b last:border-0 align-top'>
                           <td className='px-4 py-3'>
                              <span className='text-gray-700'>{def?.title || c.checkId}</span>
                              <span className='block text-[11px] text-gray-400 mt-0.5'>{c.checkId}</span>
                           </td>
                           <td className='px-4 py-3'>
                              <span
                              className={`inline-block text-[11px] px-1.5 py-0.5 rounded ${pill.className}`}
                              title={def?.help || ''}>
                                 {pill.label}
                              </span>
                           </td>
                           <td className='px-4 py-3 text-xs text-gray-500 max-w-[190px] truncate' title={c.url}>{shortUrl(c.url, domain)}</td>
                           <td className='px-4 py-3 text-[11px] text-gray-500 font-mono leading-relaxed'>{evidenceText(c.evidence)}</td>
                           <td className='px-4 py-3 text-right text-xs text-gray-400 tabular-nums'>{c.weight}</td>
                        </tr>
                     );
                  })}
                  {visible.length === 0 && (
                     <tr><td colSpan={5} className='px-4 py-8 text-center text-sm text-gray-500'>
                        {onlyProblems ? 'Nada que arreglar en esta selección.' : 'Sin verificaciones para esta selección.'}
                     </td></tr>
                  )}
               </tbody>
            </table>
         </div>
         <p className='text-[11px] text-gray-400 mt-2'>
            {visible.length} de {checks.length} verificaciones · <strong>No medible</strong> no es un fallo: sale del cálculo y baja la cobertura.
         </p>
      </div>
   );
};

export default AuditChecks;
