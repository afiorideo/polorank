import React from 'react';
import Icon from '../common/Icon';

type AuditPanelProps = {
   domain: DomainType | null,
}

/**
 * PoloRank — SEO audit panel. Phase 1 ships the empty state on purpose: the tables and the check engine exist,
 * nothing has been crawled yet. Showing a fabricated score before the first run would be exactly the failure
 * mode this module is designed to avoid.
 */
const AuditPanel = ({ domain }: AuditPanelProps) => {
   if (!domain) { return <div className='w-full h-40' />; }
   return (
      <div className='audit_panel w-full mt-6 bg-surface rounded-md border border-gray-200 lg:border-0 lg:rounded-none'>
         <div className='px-6 py-14 text-center'>
            <span className='inline-block text-indigo-300 mb-4'><Icon type='research' size={38} color='currentColor' /></span>
            <h3 className='font-semibold text-gray-700 mb-2'>Todavía no hay auditorías de {domain.domain}</h3>
            <p className='text-sm text-gray-500 max-w-[480px] mx-auto leading-relaxed'>
               Esta pantalla va a mostrar qué tan optimizado está el sitio, bloque por bloque, y su evolución en el tiempo —
               cruzada con el historial de posiciones que ya se está midiendo.
            </p>
            <p className='text-xs text-gray-400 mt-5'>
               El motor de auditoría se habilita en la próxima fase. El seguimiento de posiciones no se ve afectado.
            </p>
         </div>
      </div>
   );
};

export default AuditPanel;
