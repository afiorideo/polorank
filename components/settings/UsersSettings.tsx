import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useFetchDomains } from '../../services/domains';
import { useCreateUser, useDeleteUser, useFetchUsers, useUpdateUser, UserRow } from '../../services/auth';
import Icon from '../common/Icon';

const ROLE_LABELS: { [k: string]: string } = {
   superadmin: 'Administrador total',
   domain_admin: 'Administrador de dominio',
   domain_user: 'Usuario de dominio',
};

const ROLE_HELP: { [k: string]: string } = {
   superadmin: 'Ve y administra todo: dominios, keywords, configuración y usuarios.',
   domain_admin: 'Ve su dominio y puede agregar o quitar keywords. No refresca posiciones.',
   domain_user: 'Solo mira el tracking de su dominio.',
};

const formatDate = (iso: string | null) => {
   if (!iso) { return '—'; }
   const d = new Date(iso);
   return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
};

const UsersSettings = () => {
   const router = useRouter();
   const { data: usersData, isLoading } = useFetchUsers(true);
   const { data: domainsData } = useFetchDomains(router);
   const resetForm = () => { setEmail(''); setRole('domain_user'); setDomainId(''); };
   const { mutate: createUser, isLoading: isCreating } = useCreateUser(resetForm);
   const { mutate: updateUser } = useUpdateUser();
   const { mutate: deleteUser } = useDeleteUser();
   const [email, setEmail] = useState('');
   const [role, setRole] = useState<string>('domain_user');
   const [domainId, setDomainId] = useState<string>('');
   const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);

   const users: UserRow[] = usersData?.users || [];
   const domains: DomainType[] = domainsData?.domains || [];
   const needsDomain = role !== 'superadmin';

   const submit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim()) { return; }
      createUser({ email: email.trim().toLowerCase(), role, domain_id: needsDomain ? (parseInt(domainId, 10) || null) : null });
   };

   const labelStyle = 'mb-2 font-semibold inline-block text-sm text-gray-700';
   const inputStyle = 'w-full p-2 border border-gray-200 rounded focus:outline-none focus:border-blue-200 text-sm';
   const selectStyle = `${inputStyle} bg-surface`;

   return (
      <div className='settings__content styled-scrollbar p-6 text-gray-600'>
         <h4 className='font-semibold text-gray-700 mb-1'>Agregar usuario</h4>
         <p className='text-xs text-gray-500 mb-4'>
            La persona entra con su correo y un código de 6 dígitos. Cada usuario de dominio ve un solo dominio.
         </p>
         <form onSubmit={submit} className='mb-6' data-testid='add_user_form'>
            <div className='mb-3'>
               <label className={labelStyle} htmlFor='new_user_email'>Correo</label>
               <input id='new_user_email' type='email' required className={inputStyle} value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder='persona@empresa.cl' />
            </div>
            <div className='mb-3'>
               <label className={labelStyle} htmlFor='new_user_role'>Rol</label>
               <select id='new_user_role' className={selectStyle} value={role} onChange={(e) => setRole(e.target.value)}>
                  {Object.keys(ROLE_LABELS).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
               </select>
               <p className='text-xs text-gray-400 mt-1'>{ROLE_HELP[role]}</p>
            </div>
            {needsDomain && (
               <div className='mb-3'>
                  <label className={labelStyle} htmlFor='new_user_domain'>Dominio (uno solo)</label>
                  <select id='new_user_domain' className={selectStyle} value={domainId} required onChange={(e) => setDomainId(e.target.value)}>
                     <option value=''>Elige un dominio…</option>
                     {domains.map((d) => <option key={d.ID} value={d.ID}>{d.domain}</option>)}
                  </select>
               </div>
            )}
            <button type='submit' disabled={isCreating || (needsDomain && !domainId)}
               className='py-2 px-5 rounded cursor-pointer bg-blue-700 text-white font-semibold text-sm disabled:opacity-60'>
               {isCreating ? 'Agregando…' : 'Agregar usuario'}
            </button>
         </form>

         <h4 className='font-semibold text-gray-700 mb-3'>Usuarios ({users.length})</h4>
         {isLoading && <p className='text-sm text-gray-400'>Cargando…</p>}
         <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
               <thead>
                  <tr className='text-left text-xs uppercase text-gray-500 border-b'>
                     <th className='py-2 pr-2'>Correo</th>
                     <th className='py-2 pr-2'>Rol</th>
                     <th className='py-2 pr-2'>Dominio</th>
                     <th className='py-2 pr-2'>Último acceso</th>
                     <th className='py-2 pr-2'>Estado</th>
                     <th className='py-2'></th>
                  </tr>
               </thead>
               <tbody>
                  {users.map((u) => (
                     <tr key={u.ID} className='border-b border-gray-100 align-top' data-testid='user_row'>
                        <td className='py-2 pr-2 break-all'>
                           {u.email}
                           {u.locked && <span className='ml-1 text-xs text-gray-400' title='Administrador principal'>🔒</span>}
                        </td>
                        <td className='py-2 pr-2'>
                           {u.locked ? ROLE_LABELS[u.role] : (
                              <select className={`${selectStyle} py-1`} value={u.role}
                                 onChange={(e) => updateUser({
                                    ID: u.ID, role: e.target.value, domain_id: e.target.value === 'superadmin' ? null : u.domain_id,
                                 })}>
                                 {Object.keys(ROLE_LABELS).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                              </select>
                           )}
                        </td>
                        <td className='py-2 pr-2'>
                           {u.role === 'superadmin' ? <span className='text-gray-400'>todos</span> : (
                              <select className={`${selectStyle} py-1`} value={u.domain_id || ''}
                                 onChange={(e) => updateUser({ ID: u.ID, domain_id: parseInt(e.target.value, 10) || null })}>
                                 <option value=''>Sin dominio</option>
                                 {domains.map((d) => <option key={d.ID} value={d.ID}>{d.domain}</option>)}
                              </select>
                           )}
                        </td>
                        <td className='py-2 pr-2 whitespace-nowrap'>{formatDate(u.last_login)}</td>
                        <td className='py-2 pr-2'>
                           {u.locked ? <span className='text-green-600'>Activo</span> : (
                              <button type='button' className={`text-xs font-semibold ${u.active ? 'text-green-600' : 'text-gray-400'}`}
                                 onClick={() => updateUser({ ID: u.ID, active: !u.active })}>
                                 {u.active ? 'Activo' : 'Inactivo'}
                              </button>
                           )}
                        </td>
                        <td className='py-2 text-right'>
                           {!u.locked && (
                              <button type='button' title='Eliminar' className='p-1 text-gray-400 hover:text-red-600'
                                 onClick={() => setConfirmDelete(u)}>
                                 <Icon type='trash' size={14} />
                              </button>
                           )}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>

         {confirmDelete && (
            <div className='mt-4 p-3 border border-red-200 bg-red-50 rounded text-sm'>
               <p className='mb-2'>¿Eliminar a <b>{confirmDelete.email}</b>? Dejará de poder entrar de inmediato.</p>
               <button type='button' className='py-1 px-3 mr-2 rounded bg-red-600 text-white text-xs font-semibold'
                  onClick={() => { deleteUser(confirmDelete.ID); setConfirmDelete(null); }}>Sí, eliminar</button>
               <button type='button' className='py-1 px-3 rounded border text-xs' onClick={() => setConfirmDelete(null)}>Cancelar</button>
            </div>
         )}
      </div>
   );
};

export default UsersSettings;
