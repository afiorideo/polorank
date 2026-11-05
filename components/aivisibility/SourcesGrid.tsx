import React from 'react';
import type { AiVisibilityData } from '../../services/aiVisibility';
import { ENGINE_ORDER, ENGINE_LABEL } from './engines';

const SourcesGrid = ({ data, domain }: { data: AiVisibilityData, domain: string }) => (
   <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
      {ENGINE_ORDER.map((e) => {
         const list = data.sources[e] || [];
         const hasOwn = list.some((s) => s.domain.includes(domain));
         const missing = data.byEngine[e].answers > 0 && !hasOwn;
         return (
            <div key={e} className={`border rounded p-3 ${missing ? 'border-red-200' : ''}`}>
               <b>{ENGINE_LABEL[e]}</b><br />
               {list.length === 0 && <span className="text-gray-400">Sin fuentes</span>}
               {list.slice(0, 5).map((s) => `${s.domain} (${s.count})`).join(' · ')}
               {missing && <>{list.length > 0 ? ' · ' : ''}<span className="text-red-700">{domain} (0)</span></>}
            </div>
         );
      })}
   </div>
);

export default SourcesGrid;
