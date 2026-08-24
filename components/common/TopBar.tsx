import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Icon from './Icon';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import type { SessionUser } from '../../utils/auth/types';

type TopbarProps = {
   showSettings: Function,
   showAddModal: Function,
   /** PoloRank: current user; when omitted (tests/legacy) all menu items are shown */
   user?: SessionUser | null,
}

const TopBar = ({ showSettings, showAddModal, user }:TopbarProps) => {
   const isAdmin = !user || user.role === 'superadmin';
   const [showMobileMenu, setShowMobileMenu] = useState<boolean>(false);
   const router = useRouter();
   const isDomainsPage = router.pathname === '/domains';

   const logoutUser = async () => {
      try {
         const fetchOpts = { method: 'POST', headers: new Headers({ 'Content-Type': 'application/json', Accept: 'application/json' }) };
         const res = await fetch(`${window.location.origin}/api/logout`, fetchOpts).then((result) => result.json());
         console.log(res);
         if (!res.success) {
            toast(res.error, { icon: '⚠️' });
         } else {
            router.push('/login');
         }
      } catch (fetchError) {
         toast('Could not logout, The Server is not responsive.', { icon: '⚠️' });
      }
   };

   return (
       <div className={`topbar flex w-full mx-auto justify-between 
       ${isDomainsPage ? 'max-w-5xl lg:justify-between' : 'max-w-7xl lg:justify-end'}  bg-surface lg:bg-transparent`}>

         <h3 className={`p-4 flex items-center ${isDomainsPage ? 'lg:pl-0' : 'lg:hidden'}`}>
            <Logo size={30} />
            <button className='px-3 py-1 font-bold text-blue-700  lg:hidden ml-3 text-lg' onClick={() => showAddModal()}>+</button>
         </h3>
         {!isDomainsPage && router.asPath !== '/research' && (
            <Link href={'/domains'} passHref={true}>
               <a className=' right-14 top-2 px-2 py-1 cursor-pointer bg-brand-soft hover:bg-indigo-100 transition-all
               absolute lg:top-3 lg:right-auto lg:left-8 lg:px-3 lg:py-2 rounded-full'>
                  <Icon type="caret-left" size={16} title="Go Back" />
               </a>
            </Link>
         )}
         <div className="topbar__right flex items-center">
            <ThemeToggle className='lg:hidden mr-1' />
            <button className={' lg:hidden p-3'} onClick={() => setShowMobileMenu(!showMobileMenu)}>
               <Icon type="hamburger" size={24} />
            </button>
            <ul
            className={`text-sm font-semibold text-gray-500 absolute mt-[-10px] right-3 bg-surface 
            border border-gray-200 lg:mt-2 lg:relative lg:block lg:border-0 lg:bg-transparent ${showMobileMenu ? 'block' : 'hidden'}`}>
               <li className={`block lg:inline-block lg:ml-5 ${router.asPath === '/domains' ? ' text-blue-700' : ''}`}>
                  <Link href={'/domains'} passHref={true}>
                     <a className='block px-3 py-2 cursor-pointer'>
                        <Icon type="domains" size={14} /> Dominios
                     </a>
                  </Link>
               </li>
               {isAdmin && <li className={`block lg:inline-block lg:ml-5 ${router.asPath === '/research' ? ' text-blue-700' : ''}`}>
                  <Link href={'/research'} passHref={true}>
                     <a className='block px-3 py-2 cursor-pointer'>
                        <Icon type="research" size={14} /> Investigación
                     </a>
                  </Link>
               </li>}
               {isAdmin && <li className='block lg:inline-block lg:ml-5'>
                  <a className='block px-3 py-2 cursor-pointer' onClick={() => showSettings()}>
                     <Icon type="settings-alt" size={14} /> Configuración
                  </a>
               </li>}
               {user && <li className='block lg:inline-block lg:ml-5 text-xs text-gray-400 font-normal px-3 py-2' title={user.role}>
                  {user.email}
               </li>}
               <li className='block lg:inline-block lg:ml-5'>
                  <a className='block px-3 py-2 cursor-pointer' onClick={() => logoutUser()}>
                     <Icon type="logout" size={14} /> Salir
                  </a>
               </li>
               <li className='hidden lg:inline-block lg:ml-4 align-middle'>
                  <ThemeToggle />
               </li>
            </ul>
         </div>
       </div>
   );
 };

 export default TopBar;
