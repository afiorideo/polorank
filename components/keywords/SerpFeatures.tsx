import React from 'react';

/** PoloRank: SERP feature icons (DinoRank-style "Snippets" column). Only features present in the last scrape are lit. */
export const SERP_FEATURES: { key: string, symbol: string, label: string }[] = [
   { key: 'featured_snippet', symbol: '★', label: 'Fragmento destacado' },
   { key: 'people_also_ask', symbol: '?', label: 'Otras preguntas' },
   { key: 'local_pack', symbol: '📍', label: 'Mapa / negocios locales' },
   { key: 'video', symbol: '▶', label: 'Videos' },
   { key: 'images', symbol: '🖼', label: 'Imágenes' },
   { key: 'shopping', symbol: '🛍', label: 'Productos / shopping' },
   { key: 'ai_overview', symbol: '✦', label: 'Resumen con IA' },
   { key: 'knowledge_graph', symbol: 'ℹ', label: 'Panel de conocimiento' },
];

type SerpFeaturesProps = {
   features?: string[],
   /** show every known icon (dimmed when absent) instead of only the present ones */
   showAll?: boolean,
   size?: 'sm' | 'md',
}

const SerpFeatures = ({ features = [], showAll = false, size = 'sm' }: SerpFeaturesProps) => {
   const present = SERP_FEATURES.filter((f) => features.includes(f.key));
   const list = showAll ? SERP_FEATURES : present;
   const box = size === 'sm' ? 'w-5 h-5 text-[11px] leading-5' : 'w-7 h-7 text-sm leading-7';
   if (list.length === 0) {
      return <span className='text-gray-300' title='Sin bloques especiales en la SERP'>—</span>;
   }
   return (
      <span className='inline-flex gap-1 flex-wrap' data-testid='serp_features'>
         {list.map((f) => {
            const on = features.includes(f.key);
            return (
               <i
               key={f.key}
               title={`${f.label}${on ? '' : ' (no aparece)'}`}
               className={`not-italic inline-block text-center rounded ${box}
               ${on ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-300'}`}>
                  {f.symbol}
               </i>
            );
         })}
      </span>
   );
};

export default SerpFeatures;
