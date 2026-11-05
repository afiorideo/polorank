import React, { useState } from 'react';
import type { AiVisibilityData, EngineCell } from '../../services/aiVisibility';
import { ENGINE_ORDER, ENGINE_LABEL } from './engines';

type PromptRow = AiVisibilityData['prompts'][number];

type Props = {
   prompts: PromptRow[],
   activeTag: string,
   onRun: (promptId: number) => void,
   onTagChange?: (tag: string) => void,
   canRun?: boolean,
   renderDetail?: (prompt: PromptRow) => React.ReactNode,
};

export const cellLabel = (c: EngineCell) => `${c.mentioned}/${c.total}${c.bestPosition ? ` · #${c.bestPosition}` : ''}`;

export const cellClass = (c: EngineCell) => {
   if (c.total === 0) { return 'text-gray-400'; }
   if (c.mentioned === 0) { return 'bg-red-100 text-red-700'; }
   return c.bestPosition === 1 ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-700';
};

const CellChip = ({ cell }: { cell: EngineCell }) => (
   cell.total === 0
      ? <span className="text-gray-400">—</span>
      : <span className={`text-[11px] px-2 py-px rounded-full font-semibold ${cellClass(cell)}`}>{cellLabel(cell)}</span>
);

const Delta = ({ value }: { value: number | null }) => {
   if (value === null) { return <span className="text-gray-400">—</span>; }
   if (value === 0) { return <span className="text-gray-500">=</span>; }
   return <span className={value > 0 ? 'text-green-600' : 'text-red-700'}>{value > 0 ? `+${value}` : value}</span>;
};

const PromptsTable = ({ prompts, activeTag, onRun, onTagChange, canRun = true, renderDetail }: Props) => {
   const [openId, setOpenId] = useState<number | null>(null);
   const tags = Array.from(new Set(prompts.flatMap((p) => p.tags)));
   const shown = activeTag ? prompts.filter((p) => p.tags.includes(activeTag)) : prompts;
   const grid = 'grid grid-cols-[minmax(0,2.6fr)_repeat(4,minmax(0,0.8fr))_minmax(0,1.6fr)_minmax(0,0.7fr)]';

   return (
      <div>
         <div className="flex items-center gap-2 mb-2 text-sm">
            {onTagChange && tags.length > 0 && <>
               <span className="text-gray-500">Etiquetas:</span>
               {['', ...tags].map((t) => (
                  <button
                  key={t || 'todas'}
                  className={`text-[11px] px-2 py-px rounded-full ${activeTag === t ? 'bg-blue-700 text-white' : 'bg-gray-100'}`}
                  onClick={() => onTagChange(t)}>
                     {t || 'todas'}
                  </button>
               ))}
            </>}
            <span className="ml-auto text-xs text-gray-400">Cada celda: veces que te nombró · tu lugar en la lista</span>
         </div>
         <div className="border-t">
            <div className={`${grid} text-[11px] uppercase tracking-wide text-gray-400`}>
               <div className="py-2 px-2">Prompt</div>
               {ENGINE_ORDER.map((e) => <div key={e} className="py-2 px-2 text-center">{ENGINE_LABEL[e]}</div>)}
               <div className="py-2 px-2">Más nombrados</div>
               <div className="py-2 px-2 text-center">vs. sem. ant.</div>
            </div>
            {shown.map((p) => (
               <div key={p.id} className="border-t">
                  <div className={`${grid} items-center hover:bg-gray-50 cursor-pointer`} onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                     <div className="py-3 px-2">
                        <div className="font-medium">{openId === p.id ? '▾' : '▸'} {p.prompt}</div>
                        <div className="mt-1 flex gap-1 items-center">
                           {p.tags.map((t) => <span key={t} className="text-[11px] px-2 py-px rounded-full bg-gray-100">{t}</span>)}
                           {canRun && (
                              <button
                              className="text-[11px] text-blue-600 ml-1"
                              onClick={(e) => { e.stopPropagation(); onRun(p.id); }}>
                                 ↻ Actualizar este prompt
                              </button>
                           )}
                        </div>
                     </div>
                     {ENGINE_ORDER.map((e) => <div key={e} className="text-center"><CellChip cell={p.cells[e]} /></div>)}
                     <div className="px-2 text-xs text-gray-600">
                        {p.topBrands.length ? p.topBrands.map((b) => `${b.name} (${b.count})`).join(' · ') : '—'}
                     </div>
                     <div className="text-center text-xs"><Delta value={p.deltaVsPrev} /></div>
                  </div>
                  {openId === p.id && renderDetail && renderDetail(p)}
               </div>
            ))}
         </div>
      </div>
   );
};

export default PromptsTable;
