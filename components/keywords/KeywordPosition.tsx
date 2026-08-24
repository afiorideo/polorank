import Icon from '../common/Icon';
import { notFoundLabel } from '../../utils/history';

type KeywordPositionProps = {
   position: number,
   updating?: boolean,
   type?: string,
   /** PoloRank: organic results received in the last scrape (drives the "+N" label) */
   resultsReceived?: number,
   /** PoloRank: depth requested in the last scrape (fallback for "+N") */
   lastDepth?: number,
   /** PoloRank: render as a coloured badge (green top 10 · amber top 20 · red 21+ · grey not found) */
   badge?: boolean,
}

/** Colour class for a position: 1–10 green, 11–20 amber, 21+ red, 0 grey. */
export const positionTone = (position: number): string => {
   if (position <= 0) { return 'bg-slate-100 text-slate-500'; }
   if (position <= 10) { return 'bg-emerald-100 text-emerald-700'; }
   if (position <= 20) { return 'bg-amber-100 text-amber-700'; }
   return 'bg-rose-100 text-rose-700';
};

const KeywordPosition = ({ position = 0, type = '', updating = false, resultsReceived = 0, lastDepth = 0, badge = false }:KeywordPositionProps) => {
   if (updating && type !== 'sc') {
      return <span title='Actualizando posición'><Icon type="loading" /></span>;
   }
   const label = !updating && position === 0 ? notFoundLabel(resultsReceived, lastDepth) : String(Math.round(position));
   const title = position === 0 ? `No aparece entre los primeros ${label.replace('+', '')} resultados` : `Posición ${label}`;
   if (badge) {
      return (
         <span title={title} className={`inline-block min-w-[38px] text-center px-2 py-1 rounded-md font-bold text-sm ${positionTone(position)}`}>
            {label}
         </span>
      );
   }
   if (position === 0) {
      return <span className='text-gray-400' title={title}>{label}</span>;
   }
   return <>{label}</>;
};

export default KeywordPosition;
