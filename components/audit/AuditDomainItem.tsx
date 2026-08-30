import React from 'react';
import Link from 'next/link';
import Icon from '../common/Icon';

type AuditDomainItemProps = {
   domain: DomainType,
}

/**
 * PoloRank — one client in the audit portfolio list, mirroring DomainItem on the Domains screen.
 * Until a site has been audited it says so plainly: showing a score before the first run would be the exact
 * failure this module exists to avoid.
 */
const AuditDomainItem = ({ domain }: AuditDomainItemProps) => {
   return (
      <Link href={`/audit/${domain.slug}`} passHref={true}>
         <a
         className='audit_domain flex items-center justify-between mt-4 p-5 rounded border bg-surface
         hover:border-indigo-300 transition cursor-pointer'>
            <div className='min-w-0'>
               <h3 className='font-semibold text-gray-700 truncate'>{domain.domain}</h3>
               <p className='text-xs text-gray-400 mt-1'>{domain.keywordCount || 0} keywords en seguimiento</p>
            </div>
            <div className='flex items-center gap-6 shrink-0'>
               <span className='text-xs text-gray-400'>Sin auditar</span>
               <span className='text-indigo-300'><Icon type='caret-right' size={16} color='currentColor' /></span>
            </div>
         </a>
      </Link>
   );
};

export default AuditDomainItem;
