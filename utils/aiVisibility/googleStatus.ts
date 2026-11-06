/** Corridas que miden Google IA de un dominio: las manuales ('google:<dominio>') y la semanal ('all'). */
export type GoogleRunRow = { ID: number, status: string, started_at: string, finished_at: string };

/** Resumen de la última medición de Google IA, para la cabecera de la vista. */
export type GoogleIaMeasure = { at: string, keywords: number, untrusted: number };

const IN_PROGRESS_MIN = 30;

/**
 * De las corridas (más reciente primero): la última terminada (done/partial) y si hay una en curso.
 * Una pendiente de más de 30 minutos se considera colgada y no se muestra como en curso.
 */
export const pickGoogleRuns = (runs: GoogleRunRow[], now: Date = new Date()): { last: GoogleRunRow | null, inProgress: boolean } => {
   const last = runs.find((r) => r.status === 'done' || r.status === 'partial') || null;
   const inProgress = runs.some((r) => r.status === 'pending'
      && now.getTime() - new Date(r.started_at).getTime() < IN_PROGRESS_MIN * 60000);
   return { last, inProgress };
};
