import React from 'react';
import Link from 'next/link';
import Icon from '../common/Icon';
import type { AuditRunSummary } from '../../services/audit';

type AuditDomainItemProps = {
   domain: DomainType,
   run?: AuditRunSummary,
}

/** Weighted average of the blocks that actually measured something. */
const globalOf = (run: AuditRunSummary): number => {
   const usable = run.blocks.filter((b) => b.checksMeasured > 0 && b.weight > 0);
   if (usable.length === 0) { return 0; }
   const w = usable.reduce((a, b) => a + b.weight, 0);
   return Math.round(usable.reduce((a, b) => a + b.weight * b.compliance, 0) / w);
};

const toneOf = (score: number): string => {
   if (score >= 80) { return 'text-emerald-600'; }
   if (score >= 50) { return 'text-amber-600'; }
   return 'text-red-600';
};

/** PoloRank — one client in the audit portfolio. Never shows a score before the site has been audited. */
const AuditDomainItem = ({ domain, run }: AuditDomainItemProps) => {
   const score = run ? globalOf(run) : null;
   const medidos = run ? run.blocks.reduce((a, b) => a + b.checksMeasured, 0) : 0;
   const totales = run ? run.blocks.reduce((a, b) => a + b.checksTotal, 0) : 0;

   return (
      <Link href={`/audit/${domain.slug}`} passHref={true}>
         <a
         className='audit_domain flex items-center justify-between mt-4 p-5 rounded border bg-surface
         hover:border-indigo-300 transition cursor-pointer'>
            <div className='min-w-0'>
               <h3 className='font-semibold text-gray-700 truncate'>{domain.domain}</h3>
               <p className='text-xs text-gray-400 mt-1'>
                  {domain.keywordCount || 0} keywords
                  {run && <span> · {run.pagesCrawled} páginas revisadas · {medidos} de {totales} verificaciones medidas</span>}
               </p>
            </div>
            <div className='flex items-center gap-6 shrink-0'>
               {score === null
                  ? <span className='text-xs text-gray-400'>Sin auditar</span>
                  : <span className={`font-bold text-xl tabular-nums ${toneOf(score)}`}>{score}%</span>}
               <span className='text-indigo-300'><Icon type='caret-right' size={16} color='currentColor' /></span>
            </div>
         </a>
      </Link>
   );
};

export default AuditDomainItem;
