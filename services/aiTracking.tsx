import { useQuery } from 'react-query';

export type CitationRatio = { cited: number, days: number, measured: number, withAi: number } | null;

export type AiReference = { position: number, source: string, domain: string, url: string, title: string, mentioned: boolean };

export type AiTrackingRow = {
   keywordID: number,
   keyword: string,
   country: string,
   volume: number,
   /** 1 citado · 0 hubo resumen y no te citó · -1 no hubo resumen */
   cited: number,
   /** 1 te nombra · 0 no te nombra · -1 no hubo resumen */
   mentioned: number,
   position: number,
   citedUrl: string,
   references: AiReference[],
   text: string,
   lastDate: string,
   periods: { d7: CitationRatio, d30: CitationRatio, d60: CitationRatio, d90: CitationRatio },
};

/** Citas en el resumen con IA de Google para todas las keywords de un dominio. */
export function useFetchAiTracking(domain: string | undefined) {
   return useQuery(['aiTracking', domain], async () => {
      const res = await fetch(`${window.location.origin}/api/ai-tracking?domain=${encodeURIComponent(domain || '')}`);
      if (res.status >= 400) { throw new Error('No se pudo cargar la información de IA'); }
      return res.json() as Promise<{ rows: AiTrackingRow[] }>;
   }, { enabled: !!domain });
}

export default useFetchAiTracking;
