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

/** PoloRank: renders a change vs. N days ago — green when improved, red when dropped, grey when equal, "—" when no data. */
const PositionChange = ({ change, withPosition = false, arrow = false, className = '' }: PositionChangeProps) => {
   if (!change || change.change === null || change.change === undefined) {
      return <span className={`text-gray-300 ${className}`} title='Sin datos para ese período'>—</span>;
   }
   if (change.change === 0 && change.position === 0) {
      return <span className={`text-gray-300 ${className}`} title='Sigue fuera de los resultados revisados'>fuera</span>;
   }
   const value = change.change;
   let tone = 'text-gray-400';
   let text = arrow ? '=' : '0';
   if (value > 0) { tone = 'text-emerald-600'; text = arrow ? `▲ ${value}` : `+${value}`; }
   if (value < 0) { tone = 'text-rose-500'; text = arrow ? `▼ ${Math.abs(value)}` : `−${Math.abs(value)}`; }
   const past = change.position === 0 ? 'fuera' : change.position;
   return (
      <span className={`font-semibold whitespace-nowrap ${tone} ${className}`} title={`Entonces: posición ${past}`}>
         {text}
         {withPosition && change.position !== null && (
            <small className='ml-1 font-normal text-gray-400'>({change.position === 0 ? '—' : change.position})</small>
         )}
      </span>
   );
};

export default PositionChange;
