import { useQuery } from 'react-query';
import type { GoogleIaMeasure } from '../utils/aiVisibility/googleStatus';

export type CitationRatio = { cited: number, days: number, measured: number, withAi: number } | null;

/** `text`: el fragmento de esa página que Google usó. Falta en las mediciones guardadas antes del 28-09-2026. */
export type AiReference = {
   position: number, source: string, domain: string, url: string, title: string, text?: string, mentioned: boolean,
};

export type AiTrackingRow = {
   keywordID: number,
   keyword: string,
   country: string,
   volume: number,
   /** 1 citado · 0 hubo resumen y no te citó · -1 no hubo resumen · -2 diferido · -3 no medido */
   cited: number,
   /** 1 te nombra · 0 no te nombra · -1 no hubo resumen */
   mentioned: number,
   position: number,
   citedUrl: string,
   references: AiReference[],
   text: string,
   lastDate: string,
   localPack: { present: boolean, position: number },
   trusted: boolean,
   paa: string[],
   periods: { w4: CitationRatio, w8: CitationRatio, w12: CitationRatio },
};

/** Citas en el resumen con IA de Google para todas las keywords de un dominio. */
/** refetchInterval: mientras corre una actualización manual de Google IA, se vuelve a pedir cada N ms (false = no). */
export function useFetchAiTracking(domain: string | undefined, refetchInterval: number | false = false) {
   return useQuery(['aiTracking', domain], async () => {
      const res = await fetch(`${window.location.origin}/api/ai-tracking?domain=${encodeURIComponent(domain || '')}`);
      if (res.status >= 400) { throw new Error('No se pudo cargar la información de IA'); }
      return res.json() as Promise<{ rows: AiTrackingRow[], measure: GoogleIaMeasure | null, inProgress: boolean }>;
   }, { enabled: !!domain, refetchInterval });
}

export default useFetchAiTracking;
