/* eslint-disable @next/next/no-img-element */
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Logo from './Logo';

type SidebarProps = {
   domains: DomainType[],
   showAddModal: Function,
   /** PoloRank: only the superadmin can add domains (default true for tests/legacy) */
   canAddDomain?: boolean,
}

const Sidebar = ({ domains, showAddModal, canAddDomain = true } : SidebarProps) => {
   const router = useRouter();

   return (
      <div className="sidebar pt-44 w-1/5 hidden lg:block" data-testid="sidebar">
         <h3 className="py-7">
            <Logo size={34} />
         </h3>
         <div className="sidebar_menu max-h-96 overflow-auto styled-scrollbar">
            <ul className=' font-medium text-sm'>
               {domains.map((d) => <li
                                 key={d.domain}
                                 className={'my-2.5 leading-10'}>
                                    <Link href={`/domain/${d.slug}`} passHref={true}>
                                       <a className={`block cursor-pointer px-4 text-ellipsis max-w-[215px] overflow-hidden whitespace-nowrap rounded
                                        rounded-r-none ${((`/domain/${d.slug}` === router.asPath || `/domain/console/${d.slug}` === router.asPath
                                        || `/domain/insight/${d.slug}` === router.asPath || `/domain/ideas/${d.slug}` === router.asPath)
                                        ? 'bg-surface text-ink border border-r-0 border-line' : 'text-muted')}`}>
                                          <img
                                          className={' inline-block mr-1'}
                                          src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=16`} alt={d.domain}
                                          />
                                          {d.domain}
                                       </a>
                                    </Link>
                                 </li>)
               }
            </ul>
         </div>
         {canAddDomain && <div className='sidebar_add border-t font-semibold text-sm text-center mt-6 w-[80%] ml-3 text-zinc-500'>
            <button data-testid="add_domain" onClick={() => showAddModal(true)} className='p-4 hover:text-blue-600'>+ Agregar dominio</button>
         </div>}
    </div>
   );
 };

 export default Sidebar;
