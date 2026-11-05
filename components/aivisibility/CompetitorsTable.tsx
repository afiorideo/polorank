import React from 'react';
import type { AiVisibilityData } from '../../services/aiVisibility';
import { ENGINE_ORDER, ENGINE_LABEL } from './engines';

const bar = (n: number, of: number) => `${of ? Math.min(100, Math.round((n / of) * 100)) : 0}%`;

const CompetitorsTable = ({ data, domain }: { data: AiVisibilityData, domain: string }) => {
   const { totals, byEngine, competitors } = data;
   return (
      <table className="w-full text-sm">
         <thead>
            <tr className="text-[11px] uppercase tracking-wide text-gray-400">
               <th className="text-left py-1.5 px-2">Marca</th><th className="py-1.5">Total</th>
               {ENGINE_ORDER.map((e) => <th key={e}>{ENGINE_LABEL[e]}</th>)}
               <th className="text-left px-2 w-1/3"></th>
            </tr>
         </thead>
         <tbody className="text-center">
            <tr className="border-t bg-blue-50 font-semibold">
               <td className="text-left py-1.5 px-2">{domain} (tú)</td><td>{totals.mentioned}</td>
               {ENGINE_ORDER.map((e) => <td key={e}>{byEngine[e].mentioned}</td>)}
               <td className="px-2"><div className="h-2 bg-blue-700 rounded" style={{ width: bar(totals.mentioned, totals.answers) }} /></td>
            </tr>
            {competitors.slice(0, 8).map((c) => (
               <tr key={c.name} className="border-t">
                  <td className="text-left py-1.5 px-2">{c.name}</td><td>{c.total}</td>
                  {ENGINE_ORDER.map((e) => <td key={e}>{c.byEngine[e]}</td>)}
                  <td className="px-2"><div className="h-2 bg-gray-400 rounded" style={{ width: bar(c.total, totals.answers) }} /></td>
               </tr>
            ))}
         </tbody>
      </table>
   );
};

export default CompetitorsTable;
