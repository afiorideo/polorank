/**
 * PoloRank — leer el historial de citas en el resumen con IA y resumirlo por período.
 *
 * La regla que gobierna todo este archivo: el denominador son las OPORTUNIDADES, no los días.
 * El resumen con IA no aparece todos los días —en la cartera actual sale el 52% de las veces—, así que
 * "18 de 30" describiría mal a un dominio citado 18 de las 22 veces que hubo resumen. El día sin resumen
 * (`ai_cited = -1`) no cuenta ni a favor ni en contra: sale del cálculo, igual que el `na` de la auditoría.
 */

/**
 * Días visible sobre días del período. `null` cuando la serie todavía no llega a cubrir el período.
 *
 * El denominador son los DÍAS DEL PERÍODO (7, 30, 60, 90), fijo para todas las filas, para poder
 * compararlas de un vistazo. `measured` y `withAi` no se muestran en la celda: viajan para el texto
 * emergente, que es donde se explica sobre qué se midió.
 */
export type CitationRatio = { cited: number, days: number, measured: number, withAi: number } | null;

/**
 * Estados de las columnas de IA. Los dos negativos significan "no se pudo medir" y NO cuentan en los
 * períodos, pero dicen cosas distintas en pantalla y por eso son dos:
 *   -1  Google no respondió con IA en esa búsqueda
 *   -2  respondió, pero entregó el contenido de forma diferida y no lo leímos
 */
export const AI_NO_SUMMARY = -1;
export const AI_DEFERRED = -2;

export type DailyCite = { date: string, ai_cited: number };

/**
 * Comienzo de la ventana de N días, contando hoy como el primero.
 *
 * Se calcula con aritmética de CALENDARIO y no restando milisegundos: en Chile el horario de verano
 * cambia en septiembre, así que `hoy − 30 × 24 h` cae a las 23:00 del día anterior al esperado y las
 * comparaciones de borde fallan por una hora. Verificado el 2026-09-28.
 */
const windowStart = (now: Date, days: number): number => (
   new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)).getTime()
);

/**
 * Parse de la clave 'YYYY-M-D' a medianoche local. Igual que utils/history.ts.
 *
 * Se exporta porque ordenar estas claves COMO TEXTO está mal y es fácil de hacer sin darse cuenta:
 * '2026-9-9' queda después de '2026-9-28' al comparar carácter por carácter, porque el mes y el día
 * no llevan cero adelante. Cualquiera que necesite ordenar por fecha debe usar esto.
 */
export const parseKey = (key: string): number => {
   const parts = (key || '').split('-').map((p) => parseInt(p, 10));
   if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) { return NaN; }
   return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
};

/**
 * Cuántas veces citaron al dominio en los últimos N días, sobre cuántas veces hubo resumen con IA.
 *
 * Devuelve null en dos casos, y el segundo es el que evita mentir:
 * - no hubo ni una oportunidad en la ventana: no es "0 de algo", es que no hubo nada
 * - **la serie todavía no llega tan atrás**: con un solo día medido, las cuatro ventanas contienen ese
 *   mismo día y las cuatro columnas dirían lo mismo. Cuatro números idénticos parecen información y no lo
 *   son — es el mismo error que las columnas de cambio cometían en agosto. Igual que en Tracking, un
 *   período sin datos de esa antigüedad muestra un guion hasta que los tenga.
 */
export const citationRatio = (rows: DailyCite[], days: number, now: Date = new Date()): CitationRatio => {
   const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
   const from = windowStart(now, days);

   // "medidos" = días en que hubo resumen con IA Y pudimos leerlo; los negativos no dicen nada sobre la cita
   const medidos = rows
      .map((r) => ({ t: parseKey(r.date), cited: r.ai_cited }))
      .filter((r) => Number.isFinite(r.t) && r.cited >= 0);
   if (medidos.length === 0) { return null; }

   // la ventana solo cuenta cuando la serie llega hasta su comienzo
   const masViejo = Math.min(...medidos.map((r) => r.t));
   if (masViejo > from) { return null; }

   const inRange = medidos.filter((r) => r.t >= from && r.t <= today);
   if (inRange.length === 0) { return null; }
   return {
      cited: inRange.filter((r) => r.cited === 1).length,
      days,
      measured: rows.filter((r) => { const t = parseKey(r.date); return Number.isFinite(t) && t >= from && t <= today; }).length,
      withAi: inRange.length,
   };
};

/** Los cuatro períodos que muestra la tabla. */
export const citationPeriods = (rows: DailyCite[], now: Date = new Date()) => ({
   d7: citationRatio(rows, 7, now),
   d30: citationRatio(rows, 30, now),
   d60: citationRatio(rows, 60, now),
   d90: citationRatio(rows, 90, now),
});

export default citationRatio;

/** Nombre de marca a buscar en el texto del resumen. Configurable por dominio; si no, sale del dominio. */
export const brandOf = (domain: string, configured?: string): string => {
   const manual = (configured || '').trim();
   if (manual) { return manual.toLowerCase(); }
   // maderasfresard.com -> maderasfresard   ·   www.ammo.cl -> ammo
   return (domain || '').replace(/^https?:\/\//, '').replace(/^www\./i, '').split('.')[0].toLowerCase();
};

/** Marcas demasiado cortas dan falsos positivos dentro de otras palabras. */
export const MIN_BRAND_LENGTH = 4;

/**
 * El texto del resumen sin lo que NO es prosa: los marcadores de cita `[[n]](url)` y las URLs sueltas.
 *
 * Esto es lo que hacía que "¿Te nombra?" fuera una copia de "¿Te cita?": el marcador lleva adentro la
 * URL de la fuente, así que buscar `thetravellab` encontraba `https://thetravellab.com.br/...` y todo
 * dominio citado quedaba automáticamente "nombrado". Verificado el 2026-09-28 con `pacote pucon chile`:
 * la marca aparecía 1 vez en el texto crudo y 0 veces al quitar los marcadores.
 */
export const prose = (text: string): string => (text || '')
   .replace(/\[\[\d+\]\]\([^)]*\)/g, ' ')
   .replace(/https?:\/\/\S+/g, ' ');

/**
 * Forma comparable de un texto: sin mayúsculas, sin acentos y sin separadores.
 *
 * Sin esto la columna no sirve para marcas de varias palabras, que son casi todas: el dominio
 * `thetravellab.com.br` da la marca pegada `thetravellab`, pero el resumen la escribe "The Travel Lab".
 * Lo mismo con los acentos: `goaraucania` contra "Go Araucanía".
 */
const flat = (text: string): string => (text || '')
   .toLowerCase()
   .normalize('NFD')
   .replace(/[̀-ͯ]/g, '')
   .replace(/[^a-z0-9]+/g, '');

/**
 * ¿El resumen NOMBRA a la marca en su texto? Distinto de citarla como fuente.
 *   1 la nombra · 0 hubo resumen y no la nombra · -1 no hubo resumen, o la marca es muy corta para buscarla
 *
 * Se busca solo en la prosa: una marca que aparece únicamente dentro del enlace de su propia cita no
 * está nombrada, está citada — y para eso ya existe la otra columna.
 *
 * Un dominio cuya marca tiene menos de 4 letras no se busca: aparecería dentro de otras palabras y
 * daría un sí falso, que es peor que no medir.
 */
export const mentionState = (text: string | null | undefined, brand: string): number => {
   if (text === null || text === undefined) { return -1; }
   const aguja = flat(brand);
   if (aguja.length < MIN_BRAND_LENGTH) { return -1; }
   return flat(prose(text)).includes(aguja) ? 1 : 0;
};
