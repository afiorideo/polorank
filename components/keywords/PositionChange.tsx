import React from 'react';
import type { KeywordChange } from '../../utils/history';

type PositionChangeProps = {
   change?: KeywordChange | null,
   /** show the past position in parentheses, e.g. "+3 (5)" */
   withPosition?: boolean,
   /** arrow style (▲ 3) instead of signed number (+3) */
   arrow?: boolean,
   className?: string,
}

/**
 * PoloRank: renders a change vs. N days ago.
 * A number is only ever shown when BOTH ends have a real position. When the keyword entered or left the checked results
 * there is no magnitude to show — how far beyond the checked depth it sat is unknowable — so only the direction is drawn.
 */
const PositionChange = ({ change, withPosition = false, arrow = false, className = '' }: PositionChangeProps) => {
   if (!change || change.state === 'nodata') {
      return <span className={`text-gray-300 ${className}`} title='Sin datos para ese período'>—</span>;
   }
   if (change.state === 'out') {
      return <span className={`text-gray-400 ${className}`} title='Sigue fuera de los resultados revisados'>=</span>;
   }
   if (change.state === 'entered') {
      return (
         <span className={`font-semibold ${className} text-emerald-600`} title='Entró: entonces no aparecía entre los resultados revisados'>
            ▲
         </span>
      );
   }
   if (change.state === 'left') {
      // the position it fell FROM is a measured fact and belongs on screen; only the size of the fall is unknowable
      return (
         <span
         className={`font-semibold whitespace-nowrap ${className} text-rose-500`}
         title={`Salió: entonces estaba en la posición ${change.position}`}>
            ▼
            {withPosition && change.position !== null && change.position > 0 && (
               <small className='ml-1 font-normal text-gray-400'>({change.position})</small>
            )}
         </span>
      );
   }
   const value = change.change || 0;
   let tone = 'text-gray-400';
   let text = '=';
   if (value > 0) { tone = 'text-emerald-600'; text = arrow ? `▲ ${value}` : `+${value}`; }
   if (value < 0) { tone = 'text-rose-500'; text = arrow ? `▼ ${Math.abs(value)}` : `−${Math.abs(value)}`; }
   return (
      <span className={`font-semibold whitespace-nowrap ${tone} ${className}`} title={`Entonces: posición ${change.position}`}>
         {text}
         {withPosition && change.position !== null && <small className='ml-1 font-normal text-gray-400'>({change.position})</small>}
      </span>
   );
};

export default PositionChange;
