import React, { useMemo, useState } from 'react';
import { useFetchUsage, usageUrl } from '../../services/usage';
import Icon from '../common/Icon';

type Period = 'month' | 'prev' | 'custom';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const usd = (n: number | null | undefined, digits = 3) => (typeof n === 'number' ? `US$ ${n.toFixed(digits)}` : '—');
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ROLE: { [k: string]: string } = { superadmin: 'Admin total', domain_admin: 'Admin de dominio', domain_user: 'Usuario' };

const periodDates = (period: Period, custom: { from: string, to: string }): { from: string, to: string, label: string } => {
   const now = new Date();
   if (period === 'month') {
      return {
         from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
         to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
         label: `${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
      };
   }
   if (period === 'prev') {
      const p = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from: iso(p), to: iso(new Date(p.getFullYear(), p.getMonth() + 1, 0)), label: `${MONTHS[p.getMonth()]} ${p.getFullYear()}` };
   }
   return { from: custom.from, to: custom.to, label: `${custom.from} → ${custom.to}` };
};

const UsageSettings = () => {
   const [period, setPeriod] = useState<Period>('month');
   const today = new Date();
   const [custom, setCustom] = useState({ from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) });
   const [withBalance, setWithBalance] = useState(false);
   const { from, to, label } = useMemo(() => periodDates(period, custom), [period, custom]);
   const { data, isLoading, error } = useFetchUsage(from, to, withBalance, !!from && !!to);
   const prev = useMemo(() => periodDates('prev', custom), [custom]);
   const { data: prevData } = useFetchUsage(prev.from, prev.to, false, period === 'month');

   const summary = data?.summary;
   let errorMessage: string | null = null;
   if (error) { errorMessage = error instanceof Error ? error.message : String(error); }
   const seg = 'inline-flex rounded-full border border-gray-200 bg-surface overflow-hidden text-xs';
   const segItem = (on: boolean) => `px-3 py-1.5 cursor-pointer select-none ${on ? 'bg-blue-700 text-white' : 'text-gray-500 hover:bg-gray-50'}`;
   const card = 'flex-1 min-w-[140px] rounded-lg border border-gray-200 bg-surface px-3 py-2';
   const cardLabel = 'block text-[10px] uppercase tracking-wide text-gray-400 font-semibold';
   const cardValue = 'block text-xl font-bold text-gray-700';
   const th = 'py-2 px-1.5 text-left text-[10px] uppercase tracking-wide text-gray-400 font-semibold border-b border-gray-200 whitespace-nowrap';
   const td = 'py-2 px-1.5 text-xs';
   const money = (n: number) => n.toFixed(3);
   const inputStyle = 'border border-gray-200 rounded px-2 py-1 text-xs bg-surface';

   return (
      <div className='settings__content styled-scrollbar p-6 text-gray-600' data-testid='usage_settings'>
         <div className='flex flex-wrap items-center gap-3 mb-4'>
            <span className={seg}>
               <span className={segItem(period === 'month')} onClick={() => setPeriod('month')}>Mes actual</span>
               <span className={segItem(period === 'prev')} onClick={() => setPeriod('prev')}>Mes anterior</span>
               <span className={segItem(period === 'custom')} onClick={() => setPeriod('custom')}>Rango</span>
            </span>
            {period === 'custom' && (
               <span className='inline-flex items-center gap-1 text-xs'>
                  <input type='date' className={inputStyle} value={custom.from} max={custom.to}
                     onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
                  <span className='text-gray-400'>→</span>
                  <input type='date' className={inputStyle} value={custom.to} min={custom.from}
                     onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
               </span>
            )}
            <a
            className='ml-auto text-xs font-semibold text-blue-700 hover:underline inline-flex items-center gap-1'
            href={typeof window !== 'undefined' ? usageUrl(from, to, '&format=csv') : '#'}
            title='Descargar el detalle de cada consulta del período'>
               <Icon type='download' size={13} /> Exportar CSV
            </a>
         </div>

         <p className='text-xs text-gray-400 mb-3'>
            Cada consulta a DataForSEO queda registrada con su costo real. Período: <b className='text-gray-600'>{label}</b>.
         </p>

         {isLoading && <p className='text-sm text-gray-400'>Calculando…</p>}
         {errorMessage ? <p className='text-sm text-red-600'>{errorMessage}</p> : null}

         {summary && (
            <>
               <div className='flex flex-wrap gap-2 mb-5' data-testid='usage_cards'>
                  <div className={card}>
                     <span className={cardLabel}>Consultas</span>
                     <span className={cardValue}>{summary.totals.calls}</span>
                     {summary.totals.errors > 0 && <span className='text-[11px] text-red-600'>{summary.totals.errors} con error</span>}
                  </div>
                  <div className={card}>
                     <span className={cardLabel}>Costo del período</span>
                     <span className={cardValue}>{usd(summary.totals.cost)}</span>
                  </div>
                  {period === 'month' && (
                     <>
                        <div className={card}><span className={cardLabel}>Mes anterior</span>
                           <span className={cardValue}>{usd(prevData?.summary?.totals.cost)}</span></div>
                        <div className={card}><span className={cardLabel}>Proyección a fin de mes</span>
                           <span className={cardValue}>{usd(summary.projectedMonth, 2)}</span>
                           <span className='text-[11px] text-gray-400'>al ritmo actual</span></div>
                     </>
                  )}
                  <div className={card}>
                     <span className={cardLabel}>Saldo DataForSEO</span>
                     {withBalance ? (
                        <>
                           <span className={cardValue}>{usd(data?.balance?.usd, 2)}</span>
                           {data?.balance?.error && <span className='text-[11px] text-red-600'>{data.balance.error}</span>}
                        </>
                     ) : (
                        <button type='button' className='text-xs font-semibold text-blue-700 hover:underline mt-1'
                           onClick={() => setWithBalance(true)}>
                           Consultar saldo
                        </button>
                     )}
                  </div>
               </div>

               <h4 className='font-semibold text-gray-700 mb-2'>Por dominio</h4>
               <div className='overflow-x-auto mb-5 rounded-lg border border-gray-200 bg-surface'>
                  <table className='w-full' data-testid='usage_by_domain'>
                     <thead><tr>
                        <th className={th}>Dominio</th>
                        <th className={`${th} text-center`} title='Keywords activas'>Kws</th>
                        <th className={`${th} text-center`}>Consultas</th>
                        <th className={`${th} text-center`} title='Automáticas (cron) / manuales'>Origen</th>
                        <th className={`${th} text-right`}>Costo US$</th>
                     </tr></thead>
                     <tbody>
                        {summary.byDomain.length === 0 && (
                           <tr><td className={`${td} text-gray-400`} colSpan={5}>Sin consultas en el período.</td></tr>
                        )}
                        {summary.byDomain.map((d) => (
                           <tr key={d.domain} className='border-b border-gray-100 last:border-0'>
                              <td className={`${td} font-semibold text-gray-700`}>{d.domain}</td>
                              <td className={`${td} text-center`}>{d.keywords}</td>
                              <td className={`${td} text-center`}>
                                 {d.calls}{d.errors > 0 && <span className='text-red-600 text-xs'> ({d.errors} err.)</span>}
                              </td>
                              <td className={`${td} text-center text-gray-500 text-xs whitespace-nowrap`}>
                                 {d.cronCalls} cron · {d.manualCalls} man.
                              </td>
                              <td className={`${td} text-right font-semibold`}>{money(d.cost)}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>

               <h4 className='font-semibold text-gray-700 mb-2'>Por usuario</h4>
               <p className='text-xs text-gray-400 mb-2'>
                  El costo de un usuario es el de su dominio; los refrescos manuales que originó se muestran aparte.
               </p>
               <div className='overflow-x-auto rounded-lg border border-gray-200 bg-surface'>
                  <table className='w-full' data-testid='usage_by_user'>
                     <thead><tr>
                        <th className={th}>Usuario</th>
                        <th className={th}>Dominio</th>
                        <th className={`${th} text-center`}>Consultas</th>
                        <th className={`${th} text-right`}>Costo US$</th>
                        <th className={`${th} text-right`}>Manuales</th>
                     </tr></thead>
                     <tbody>
                        {summary.byUser.map((u) => (
                           <tr key={u.ID} className={`border-b border-gray-100 last:border-0 ${u.active ? '' : 'opacity-50'}`}>
                              <td className={`${td} break-all`}>
                                 {u.email}{!u.active && <span className='ml-1 text-xs text-gray-400'>(inactivo)</span>}
                                 <span className='block text-[10px] text-gray-400'>{ROLE[u.role] || u.role}</span>
                              </td>
                              <td className={`${td} text-gray-500`}>{u.domain || 'todos'}</td>
                              <td className={`${td} text-center`}>{u.calls}</td>
                              <td className={`${td} text-right font-semibold`}>{money(u.cost)}</td>
                              <td className={`${td} text-right text-gray-500`}>
                                 {u.manualCalls > 0 ? `${u.manualCalls} · ${money(u.manualCost)}` : '—'}
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </>
         )}
      </div>
   );
};

export default UsageSettings;
