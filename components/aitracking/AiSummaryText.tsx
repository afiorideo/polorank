import React from 'react';
import { parseAiText, domainOfUrl } from '../../utils/aiText';
import type { AiTextPart } from '../../utils/aiText';

type AiSummaryTextProps = {
   text: string,
   /** Dominio propio: sus citas se resaltan para poder encontrarlas de un vistazo. */
   domain: string,
   /** Para poner el nombre de la fuente en la etiqueta en vez de la URL cruda. */
   sources: { domain: string, source: string }[],
}

/**
 * PoloRank — el resumen de Google tal como lo escribió, con sus citas donde van.
 *
 * Lo que importa acá es el marcador de cita: dice EN QUÉ FRASE Google usa cada fuente. Antes se borraba
 * y el texto se pintaba plano, así que se leía como un bloque corrido y no se veía dónde aparecía uno.
 */
const AiSummaryText = ({ text, domain, sources }: AiSummaryTextProps) => {
   const mine = domainOfUrl(domain);
   const nameOf = (host: string): string => sources.find((s) => domainOfUrl(s.domain) === host)?.source || host;

   const renderPart = (p: AiTextPart, i: number) => {
      if (p.type === 'bold') { return <strong key={i} className='text-gray-700'>{p.text}</strong>; }
      if (p.type === 'mark') { return <em key={i} className='not-italic bg-amber-50 text-gray-700 px-0.5 rounded'>{p.text}</em>; }
      if (p.type === 'cite') {
         const host = domainOfUrl(p.url);
         const esMio = host === mine;
         return (
            <a
            key={i}
            href={p.url}
            target='_blank'
            rel='noreferrer'
            title={`Google cita acá a ${nameOf(host)}`}
            className={`inline-block align-baseline ml-1 px-1.5 rounded text-[10px] font-semibold no-underline
            ${esMio ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
               {nameOf(host)}
            </a>
         );
      }
      return <React.Fragment key={i}>{p.text}</React.Fragment>;
   };

   const blocks = parseAiText(text);
   if (blocks.length === 0) { return null; }

   return (
      <div className='text-[13px] text-gray-600 leading-relaxed flex flex-col gap-2'>
         {blocks.map((b, i) => {
            if (b.type === 'heading') {
               return <h5 key={i} className='text-gray-700 font-semibold text-xs uppercase tracking-wide mt-2'>{b.text}</h5>;
            }
            if (b.type === 'bullet') {
               return (
                  <div key={i} className='flex gap-2 pl-1'>
                     <span className='text-gray-300 shrink-0'>·</span>
                     <span>{b.parts.map(renderPart)}</span>
                  </div>
               );
            }
            return <p key={i}>{b.parts.map(renderPart)}</p>;
         })}
      </div>
   );
};

export default AiSummaryText;
