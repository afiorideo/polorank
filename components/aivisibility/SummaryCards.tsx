import React from 'react';
import type { AiVisibilityData } from '../../services/aiVisibility';

const pos = (n: number) => (n ? `#${String(n).replace('.', ',')}` : '—');

const SummaryCards = ({ data }: { data: AiVisibilityData }) => {
   const { totals, competitors } = data;
   const pct = totals.answers ? Math.round((totals.mentioned / totals.answers) * 100) : 0;
   const top = competitors[0];
   return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
         <div className="border rounded p-3">
            <div className="text-[11px] uppercase text-gray-400 tracking-wide">Te nombran</div>
            <div className="text-2xl font-semibold">{totals.mentioned} <span className="text-base text-gray-400">/ {totals.answers}</span></div>
            <div className="text-xs text-gray-500">respuestas ({pct}%)</div>
         </div>
         <div className="border rounded p-3">
            <div className="text-[11px] uppercase text-gray-400 tracking-wide">Te citan como fuente</div>
            <div className="text-2xl font-semibold">{totals.cited} <span className="text-base text-gray-400">/ {totals.answers}</span></div>
            <div className="text-xs text-gray-500">tu sitio o tus redes</div>
         </div>
         <div className="border rounded p-3">
            <div className="text-[11px] uppercase text-gray-400 tracking-wide">Lugar promedio</div>
            <div className="text-2xl font-semibold">{pos(totals.avgPosition)}</div>
            <div className="text-xs text-gray-500">cuando te nombran</div>
         </div>
         <div className="border rounded p-3">
            <div className="text-[11px] uppercase text-gray-400 tracking-wide">Competidor principal</div>
            <div className="text-lg font-semibold leading-tight mt-1">{top ? top.name : '—'}</div>
            {top && <div className="text-xs text-gray-500">{top.total} / {totals.answers}</div>}
         </div>
      </div>
   );
};

export default SummaryCards;
