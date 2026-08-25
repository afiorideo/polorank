import React, { useMemo, useState } from 'react';
import Modal from '../common/Modal';
import { useUpdateKeywordScrape } from '../../services/keywords';
import { describeScrape, KeywordScrapeSettings as ScrapeOverride, resolveScrapeStrategy } from '../../utils/depth';

type Mode = 'inherit' | 'basic' | 'custom' | 'smart';

type KeywordScrapeSettingsProps = {
   keywords: KeywordType[],
   domain: DomainType | null,
   settings?: SettingsType,
   closeModal: Function,
}

const COST_PER_PAGE = 0.002;

/**
 * PoloRank — "Profundidad de búsqueda" for one or several keywords.
 * Options: inherit from the domain (default) · first page only · N pages · smart (+ full fallback).
 */
const KeywordScrapeSettings = ({ keywords, domain, settings, closeModal }: KeywordScrapeSettingsProps) => {
   const single = keywords.length === 1 ? keywords[0] : null;
   const inherited = useMemo(() => resolveScrapeStrategy(settings || { scraper_type: '' } as SettingsType, domain), [settings, domain]);
   const current = single?.scrapeSettings || null;

   const initialMode: Mode = current ? (current.scrape_strategy as Mode) : 'inherit';
   const [mode, setMode] = useState<Mode>(initialMode);
   const [pages, setPages] = useState<number>(current?.scrape_pagination_limit || inherited.paginationLimit || 5);
   const [fallback, setFallback] = useState<boolean>(current?.scrape_smart_full_fallback ?? false);
   const { mutate: save, isLoading } = useUpdateKeywordScrape(() => closeModal());

   const submit = () => {
      const ids = keywords.map((k) => k.ID);
      if (mode === 'inherit') { save({ ids, scrape: null }); return; }
      const scrape: ScrapeOverride = { scrape_strategy: mode };
      if (mode === 'custom') { scrape.scrape_pagination_limit = pages; }
      if (mode === 'smart') { scrape.scrape_smart_full_fallback = fallback; }
      save({ ids, scrape });
   };

   const costHint = (m: Mode): string => {
      if (m === 'basic') { return `${COST_PER_PAGE.toFixed(3)} USD/día por keyword`; }
      if (m === 'custom') { return `${(pages * COST_PER_PAGE).toFixed(3)} USD/día por keyword`; }
      if (m === 'smart') {
         return `0,004–0,012 USD/día según dónde esté${fallback ? ' (+0,020 los días que no aparezca)' : ''}`;
      }
      return `${describeScrape(inherited)} · ${inherited.source === 'domain' ? 'configuración del dominio' : 'configuración global'}`;
   };

   const title = single ? `Profundidad de búsqueda · ${single.keyword}` : `Profundidad de búsqueda · ${keywords.length} keywords`;
   const option = (m: Mode, label: string, help: string) => (
      <label
      className={`flex items-start gap-3 px-3 py-2 rounded-lg border cursor-pointer
      ${mode === m ? 'border-blue-700 bg-indigo-50' : 'border-gray-200'}`}>
         <input type='radio' name='scrape_mode' className='mt-1' checked={mode === m} onChange={() => setMode(m)} />
         <span className='flex-1'>
            <span className='block font-semibold text-gray-700'>{label}</span>
            <span className='block text-xs text-gray-500'>{help} <span className='text-gray-400'>· {costHint(m)}</span></span>
         </span>
      </label>
   );

   return (
      <Modal closeModal={() => closeModal()} title={title} width='[480px]' verticalCenter>
         <div className='text-sm my-3 flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto styled-scrollbar pr-1' data-testid='scrape_settings'>
            {option('inherit', 'Heredar del dominio', 'Lo que tenga configurado el dominio (o la configuración global).')}
            {option('basic', 'Solo la primera página', 'Top 10; si cae de la primera página se verá como "+10".')}
            {option('custom', 'N páginas fijas', 'Siempre la misma profundidad, esté donde esté.')}
            {mode === 'custom' && (
               <div className='ml-9 flex items-center gap-2 text-xs text-gray-600'>
                  <span>Páginas:</span>
                  <select
                  className='border border-gray-200 rounded px-2 py-1 bg-surface'
                  value={pages}
                  onChange={(e) => setPages(parseInt(e.target.value, 10))}>
                     {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n} ({n * 10} resultados)</option>)}
                  </select>
               </div>
            )}
            {option('smart', 'Smart', 'Hasta una página más allá de donde estaba ayer; nueva o fuera → solo la primera.')}
            {mode === 'smart' && (
               <label className='ml-9 flex items-center gap-2 text-xs text-gray-600 cursor-pointer'>
                  <input type='checkbox' checked={fallback} onChange={(e) => setFallback(e.target.checked)} />
                  Full fallback: si no la encuentra, buscar hasta 100 (+0,020 USD ese día)
               </label>
            )}
         </div>
         <div className='mt-3 text-right font-semibold'>
            <button className='py-1 px-5 rounded cursor-pointer bg-indigo-50 text-slate-500 mr-3' onClick={() => closeModal()}>Cancelar</button>
            <button className='py-1 px-5 rounded cursor-pointer bg-blue-700 text-white disabled:opacity-60' disabled={isLoading} onClick={submit}>
               {isLoading ? 'Guardando…' : 'Guardar'}
            </button>
         </div>
      </Modal>
   );
};

export default KeywordScrapeSettings;
