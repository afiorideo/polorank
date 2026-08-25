import React, { useState } from 'react';
import Modal from '../common/Modal';
import { useUpdateKeywordTarget } from '../../services/keywords';
import { targetPath, toTargetUrl } from '../../utils/targetUrl';

type KeywordTargetUrlProps = {
   keyword: KeywordType,
   closeModal: Function,
}

/**
 * PoloRank — "URL objetivo" of one keyword: the landing that should rank for it.
 * Optional: without it the keyword tracks the domain position only (SerpBear behaviour).
 */
const KeywordTargetUrl = ({ keyword, closeModal }: KeywordTargetUrlProps) => {
   const [value, setValue] = useState<string>(keyword.targetUrl ? targetPath(keyword.targetUrl, keyword.domain) : '');
   const [error, setError] = useState<string>('');
   const { mutate: save, isLoading } = useUpdateKeywordTarget(() => closeModal());

   const submit = (clear = false) => {
      if (clear) { save({ ids: [keyword.ID], targetUrl: null }); return; }
      const resolved = toTargetUrl(value, keyword.domain);
      if (!resolved) {
         setError(`Debe ser una página de ${keyword.domain}: la URL completa o la ruta (por ejemplo /vestidos-de-graduacion/).`);
         return;
      }
      setError('');
      save({ ids: [keyword.ID], targetUrl: resolved });
   };

   return (
      <Modal closeModal={() => closeModal()} title={`URL objetivo · ${keyword.keyword}`} width='[480px]' verticalCenter>
         <div className='text-sm my-3' data-testid='target_url_modal'>
            <p className='text-xs text-gray-500 mb-3'>
               La página que debería posicionar para esta keyword. Además de la posición del dominio, PoloRank buscará
               esta URL en la misma SERP (sin costo extra) y avisará cuando rankee otra página.
            </p>
            <input
               className='w-full border rounded border-gray-200 py-2 px-3 outline-none focus:border-indigo-300 bg-surface'
               placeholder={`/ruta-de-la-landing/  o  https://${keyword.domain}/ruta/`}
               value={value}
               autoFocus
               onChange={(e) => { setValue(e.target.value); setError(''); }}
               onKeyDown={(e) => { if (e.key === 'Enter') { submit(); } }}
            />
            {error && <p className='mt-2 text-xs text-red-600'>{error}</p>}
            {keyword.url && (
               <p className='mt-2 text-xs text-gray-400'>
                  Hoy rankea con: <span className='text-gray-500'>{keyword.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
               </p>
            )}
         </div>
         <div className='mt-3 flex justify-between items-center font-semibold'>
            <div>
               {keyword.targetUrl && (
                  <button
                  className='py-1 px-3 rounded cursor-pointer text-red-500 hover:bg-red-50 text-xs'
                  disabled={isLoading}
                  onClick={() => submit(true)}>
                     Quitar URL objetivo
                  </button>
               )}
            </div>
            <div>
               <button className='py-1 px-5 rounded cursor-pointer bg-indigo-50 text-slate-500 mr-3' onClick={() => closeModal()}>Cancelar</button>
               <button
               className='py-1 px-5 rounded cursor-pointer bg-blue-700 text-white disabled:opacity-60'
               disabled={isLoading}
               onClick={() => submit()}>
                  {isLoading ? 'Guardando…' : 'Guardar'}
               </button>
            </div>
         </div>
      </Modal>
   );
};

export default KeywordTargetUrl;
