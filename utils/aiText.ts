/**
 * PoloRank — el texto del resumen con IA de Google viene en markdown, y trae dentro los marcadores de cita.
 *
 * Ejemplo real:
 *   "Um pacote custa `a partir de R$ 5.795,00`.[[1]](https://desviantes.com.br/...)
 *
 *    ### O que inclui
 *
 *    - **Hospedagem:** De 3 a 6 noites."
 *
 * Los `[[n]](url)` son la parte valiosa y antes se borraban: dicen EN QUÉ FRASE Google cita a cada fuente.
 * El número se reinicia en cada bloque, así que no sirve como identificador — lo que identifica a la fuente
 * es la URL. Renderizado como texto plano, todo esto colapsa en un párrafo ilegible.
 */

export type AiTextPart =
   | { type: 'text', text: string }
   | { type: 'bold', text: string }
   | { type: 'mark', text: string }
   | { type: 'cite', url: string };

export type AiTextBlock =
   | { type: 'heading', text: string }
   | { type: 'bullet', parts: AiTextPart[] }
   | { type: 'paragraph', parts: AiTextPart[] };

const CITE = /\[\[\d+\]\]\(([^)]*)\)/g;
const BOLD = /\*\*([^*]+)\*\*/g;
const MARK = /`([^`]+)`/g;

/** Trocea una línea en texto, negritas, resaltados y citas, conservando el orden. */
export const parseInline = (line: string): AiTextPart[] => {
   const parts: AiTextPart[] = [];
   // se marcan los tramos especiales con separadores que no pueden aparecer en el texto
   const marked = line
      .replace(CITE, (_m, url) => `\u0000cite:${url}\u0000`)
      .replace(BOLD, (_m, t) => `\u0000bold:${t}\u0000`)
      .replace(MARK, (_m, t) => `\u0000mark:${t}\u0000`);
   marked.split('\u0000').forEach((chunk) => {
      if (!chunk) { return; }
      if (chunk.startsWith('cite:')) { parts.push({ type: 'cite', url: chunk.slice(5) }); return; }
      if (chunk.startsWith('bold:')) { parts.push({ type: 'bold', text: chunk.slice(5) }); return; }
      if (chunk.startsWith('mark:')) { parts.push({ type: 'mark', text: chunk.slice(5) }); return; }
      parts.push({ type: 'text', text: chunk });
   });
   return parts;
};

/** Convierte el markdown del resumen en bloques listos para pintar. */
export const parseAiText = (text: string | null | undefined): AiTextBlock[] => {
   if (!text) { return []; }
   return text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line): AiTextBlock => {
         if (line.startsWith('#')) { return { type: 'heading', text: line.replace(/^#+\s*/, '') }; }
         if (line.startsWith('- ') || line.startsWith('* ')) { return { type: 'bullet', parts: parseInline(line.slice(2)) }; }
         return { type: 'paragraph', parts: parseInline(line) };
      });
};

/** Dominio comparable: sin protocolo, sin www, en minúscula. */
export const domainOfUrl = (url: string): string => {
   try {
      return new URL(url).host.replace(/^www\./i, '').toLowerCase();
   } catch {
      return (url || '').replace(/^https?:\/\//, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
   }
};

export default parseAiText;
