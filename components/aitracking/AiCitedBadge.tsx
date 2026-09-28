import React from 'react';

type AiCitedBadgeProps = {
   /** 1 sí · 0 hubo resumen y no · -1 no hubo resumen */
   cited: number,
   /** Cambia solo los textos de ayuda: el estado se dibuja igual en los dos casos. */
   kind?: 'citation' | 'mention',
}

/**
 * PoloRank — los tres estados de la cita en el resumen con IA.
 *
 * El gris es el que importa: `N/A` significa que Google no respondió con IA para esa búsqueda, y eso
 * NO es "no te citan". Pintarlo como una cruz roja llenaría de falsos problemas la pantalla de un
 * cliente como Ammo, donde el resumen aparece en el 5% de las búsquedas.
 */
const TITULOS = {
   citation: { si: 'Google te cita como fuente de su resumen', no: 'Hubo resumen con IA y no te citó como fuente' },
   mention: { si: 'El texto del resumen nombra tu marca', no: 'Hubo resumen con IA y no nombra tu marca' },
};

const AiCitedBadge = ({ cited, kind = 'citation' }: AiCitedBadgeProps) => {
   const t = TITULOS[kind];
   if (cited === 1) {
      return (
         <span
         className='inline-block text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold'
         title={t.si}>
            ✓ Sí
         </span>
      );
   }
   if (cited === 0) {
      return (
         <span
         className='inline-block text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-semibold'
         title={t.no}>
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
