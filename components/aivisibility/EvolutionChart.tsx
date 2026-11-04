import React from 'react';
import type { AiVisibilityData } from '../../services/aiVisibility';

const fmtWeek = (w: string) => {
   const d = new Date(`${w}T12:00:00`);
   return `${String(d.getDate()).padStart(2, '0')}-${d.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '')}`;
};

const EvolutionChart = ({ evolution }: { evolution: AiVisibilityData['evolution'] }) => {
   if (evolution.length < 2) {
      return (
         <div className="border rounded p-4 text-xs text-gray-500">
            La evolución aparece desde la segunda medición semanal.
         </div>
      );
   }
   const x = (i: number) => 60 + (i * 440) / (evolution.length - 1);
   const y = (rate: number) => 120 - rate * 100;
   const line = (key: 'ownRate' | 'competitorRate') => evolution.map((e, i) => `${x(i)},${y(e[key])}`).join(' ');
   const last = evolution[evolution.length - 1];
   return (
      <div className="border rounded p-4">
         <svg viewBox="0 0 600 140" className="w-full h-36">
            <line x1="40" y1="120" x2="590" y2="120" stroke="#e5e7eb" />
            <line x1="40" y1="20" x2="590" y2="20" stroke="#f3f4f6" />
            <text x="5" y="24" fontSize="10" fill="#9ca3af">100%</text><text x="15" y="124" fontSize="10" fill="#9ca3af">0%</text>
            <polyline fill="none" stroke="#2563eb" strokeWidth="2.5" points={line('ownRate')} />
            <polyline fill="none" stroke="#9ca3af" strokeWidth="2" strokeDasharray="4 3" points={line('competitorRate')} />
            <g fontSize="10" fill="#6b7280">
               {evolution.map((e, i) => <text key={e.week} x={x(i) - 15} y="136">{fmtWeek(e.week)}</text>)}
            </g>
            <text x={505} y={y(last.ownRate) - 5} fontSize="10" fill="#2563eb">Tú</text>
            {last.topCompetitor && <text x={505} y={y(last.competitorRate) + 12} fontSize="10" fill="#6b7280">{last.topCompetitor}</text>}
         </svg>
         <div className="text-xs text-gray-500">% de respuestas que te nombran, por semana.</div>
      </div>
   );
};

export default EvolutionChart;
