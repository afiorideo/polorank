import React from 'react';

type DonutScoreProps = {
   label: string,
   /** The big number: weighted average over what could be measured. */
   compliance: number,
   /** The second number: how much of the block was actually assessed. Never hidden — see below. */
   coverage: number,
   weight?: number,
   cappedBy?: string,
   checksMeasured?: number,
   checksTotal?: number,
   size?: number,
}

/** Green from 80, amber from 50, red below. Grey when nothing could be measured. */
const toneOf = (compliance: number, measurable: boolean): string => {
   if (!measurable) { return 'var(--donut-none, #cbd5e1)'; }
   if (compliance >= 80) { return '#059669'; }
   if (compliance >= 50) { return '#b45309'; }
   return '#dc2626';
};

/**
 * PoloRank — one block of the audit, as a donut with TWO numbers.
 *
 * The second number is the point. A block reading 100% / 55% is not the same as 100% / 95%: the first passed
 * everything it could measure, and measured half the block. Showing only compliance is how a dashboard ends up
 * saying "all green" about a site it barely looked at.
 */
const DonutScore = ({
   label, compliance, coverage, weight, cappedBy = '', checksMeasured = 0, checksTotal = 0, size = 84,
}: DonutScoreProps) => {
   const measurable = checksTotal === 0 ? coverage > 0 : checksMeasured > 0;
   const tone = toneOf(compliance, measurable);
   const ring = { width: size, height: size, background: `conic-gradient(${tone} 0 ${measurable ? compliance : 0}%, #e5e7eb 0)` };
   const title = measurable
      ? `${label}: ${compliance}% de cumplimiento sobre ${checksMeasured} de ${checksTotal} verificaciones`
      : `${label}: todavía no hay nada medido en este bloque`;

   return (
      <div className='audit_donut flex flex-col items-center text-center gap-2 p-4 rounded-md border bg-surface' title={title}>
         <div className='relative rounded-full grid place-items-center' style={ring}>
            <div className='absolute rounded-full bg-surface' style={{ inset: 9 }} />
            <span className='relative font-bold text-lg tabular-nums' style={{ color: measurable ? tone : '#94a3b8' }}>
               {measurable ? `${Math.round(compliance)}%` : '—'}
            </span>
         </div>
         <span className='text-xs font-semibold text-gray-600 leading-tight'>{label}</span>
         <div className='w-full'>
            <div className='h-[3px] rounded bg-gray-200 overflow-hidden'>
               <i className='block h-full bg-gray-400 rounded' style={{ width: `${coverage}%` }} />
            </div>
            <span className='block text-[10px] text-gray-400 mt-1 tabular-nums'>
               cobertura {Math.round(coverage)}%{weight !== undefined ? ` · peso ${weight}` : ''}
            </span>
         </div>
         {cappedBy && <span className='text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded'>{cappedBy}</span>}
      </div>
   );
};

export default DonutScore;
