import React from 'react';
import type { AiVisibilityData } from '../../services/aiVisibility';
import { ENGINE_ORDER, ENGINE_LABEL } from './engines';

const chipClass = (withMention: number, prompts: number) => {
   if (prompts === 0) { return 'bg-gray-100 text-gray-500'; }
   if (withMention === 0) { return 'bg-red-100 text-red-700'; }
   return withMention === prompts ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-700';
};

const EngineCards = ({ byEngine }: { byEngine: AiVisibilityData['byEngine'] }) => (
   <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 text-sm">
      {ENGINE_ORDER.map((e) => {
         const c = byEngine[e];
         return (
            <div key={e} className="border rounded p-3 flex justify-between items-center">
               <span>{ENGINE_LABEL[e]}</span>
               <span className="text-right">
                  <span className={`text-[11px] px-2 py-px rounded-full font-semibold ${chipClass(c.promptsWithMention, c.prompts)}`}>
                     {c.promptsWithMention} de {c.prompts} prompts
                  </span><br />
                  <span className="text-[10px] text-gray-400">{c.mentioned} de {c.answers} respuestas</span>
               </span>
            </div>
         );
      })}
   </div>
);

export default EngineCards;
