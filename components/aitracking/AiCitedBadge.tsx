import React from 'react';

type AiCitedBadgeProps = {
   /** 1 citado · 0 hubo resumen y no te citó · -1 no hubo resumen */
   cited: number,
}

/**
 * PoloRank — los tres estados de la cita en el resumen con IA.
 *
 * El gris es el que importa: `N/A` significa que Google no respondió con IA para esa búsqueda, y eso
 * NO es "no te citan". Pintarlo como una cruz roja llenaría de falsos problemas la pantalla de un
 * cliente como Ammo, donde el resumen aparece en el 5% de las búsquedas.
 */
const AiCitedBadge = ({ cited }: AiCitedBadgeProps) => {
   if (cited === 1) {
      return (
         <span
         className='inline-block text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold'
         title='Google te cita en su resumen con IA'>
            ✓ Sí
         </span>
      );
   }
   if (cited === 0) {
      return (
         <span
         className='inline-block text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-semibold'
         title='Hubo resumen con IA y no te citó'>
            ✗ No
         </span>
      );
   }
   return (
      <span
      className='inline-block text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500'
      title='Google no respondió con IA para esta búsqueda. No es que no te citen: no hubo resumen.'>
         — N/A
      </span>
   );
};

export default AiCitedBadge;
