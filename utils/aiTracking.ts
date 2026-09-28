/**
 * PoloRank — leer el historial de citas en el resumen con IA y resumirlo por período.
 *
 * La regla que gobierna todo este archivo: el denominador son las OPORTUNIDADES, no los días.
 * El resumen con IA no aparece todos los días —en la cartera actual sale el 52% de las veces—, así que
 * "18 de 30" describiría mal a un dominio citado 18 de las 22 veces que hubo resumen. El día sin resumen
 * (`ai_cited = -1`) no cuenta ni a favor ni en contra: sale del cálculo, igual que el `na` de la auditoría.
 */

/** Citas conseguidas sobre oportunidades que hubo. `null` cuando no hubo ninguna oportunidad. */
export type CitationRatio = { cited: number, chances: number } | null;

export type DailyCite = { date: string, ai_cited: number };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse de la clave 'YYYY-M-D' a medianoche local. Igual que utils/history.ts. */
const parseKey = (key: string): number => {
   const parts = (key || '').split('-').map((p) => parseInt(p, 10));
   if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) { return NaN; }
   return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
};

/**
 * Cuántas veces citaron al dominio en los últimos N días, sobre cuántas veces hubo resumen con IA.
 * Devuelve null cuando en ese período no hubo ni una sola oportunidad: no es 0 de algo, es que no hubo nada.
 */
export const citationRatio = (rows: DailyCite[], days: number, now: Date = new Date()): CitationRatio => {
   const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
   const from = today - (days - 1) * DAY_MS;
   const inRange = rows.filter((r) => {
      const t = parseKey(r.date);
      return Number.isFinite(t) && t >= from && t <= today;
   });
   const chances = inRange.filter((r) => r.ai_cited !== -1).length;
   if (chances === 0) { return null; }
   return { cited: inRange.filter((r) => r.ai_cited === 1).length, chances };
};

/** Los cuatro períodos que muestra la tabla. */
export const citationPeriods = (rows: DailyCite[], now: Date = new Date()) => ({
   d7: citationRatio(rows, 7, now),
   d30: citationRatio(rows, 30, now),
   d60: citationRatio(rows, 60, now),
   d90: citationRatio(rows, 90, now),
});

export default citationRatio;
