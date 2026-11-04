import type { NextApiRequest, NextApiResponse } from 'next';
import { Op } from 'sequelize';
import db from '../../database/database';
import Keyword from '../../database/models/keyword';
import KeywordDaily from '../../database/models/keywordDaily';
import { authenticate } from '../../utils/verifyUser';
import { canAccessDomain } from '../../utils/auth/guards';
import { citationPeriodsWeeks, parseKey, brandOf, mentionState, AI_NOT_MEASURED } from '../../utils/aiTracking';
import type { CitationRatio } from '../../utils/aiTracking';

/** Una fila de la tabla de Tracking IA. */
export type AiTrackingRow = {
   keywordID: number,
   keyword: string,
   country: string,
   volume: number,
   /** 1 citado · 0 hubo resumen y no te citó · -1 no hubo resumen */
   cited: number,
   /** 1 te nombra en el texto · 0 hubo resumen y no te nombra · -1 no hubo resumen */
   mentioned: number,
   /** Puesto entre las fuentes citadas, 0 si no está. */
   position: number,
   /** Qué página propia citó el resumen. */
   citedUrl: string,
   /** Cada fuente citada, con si además la nombra en el texto. */
   references: (AiOverviewReference & { mentioned: boolean })[],
   text: string,
   /** Fecha del último día con dato de IA. */
   lastDate: string,
   /** Posición en el Local Pack de la última medición confiable que lo trajo (0 si no aparece). */
   localPack: { present: boolean, position: number },
   /** false si la última página de Google vino alterada (no coincide con Serper). */
   trusted: boolean,
   /** Otras preguntas de los usuarios (People Also Ask). */
   paa: string[],
   periods: { w4: CitationRatio, w8: CitationRatio, w12: CitationRatio },
};

const norm = (d: string): string => (d || '').replace(/^https?:\/\//, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();

const parseJson = <T, >(raw: unknown, fallback: T): T => {
   try { return JSON.parse((raw as string) || '') as T; } catch { return fallback; }
};

/**
 * PoloRank — Tracking IA: para cada keyword del dominio, si el resumen con IA de Google la cita.
 * Solo lectura. El alta y la edición de keywords siguen viviendo en Tracking.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const auth = await authenticate(req, res);
   if (!auth.authorized) { return res.status(401).json({ error: auth.error }); }
   if (req.method !== 'GET') { return res.status(405).json({ error: 'Método no permitido.' }); }

   const domain = (req.query.domain as string) || '';
   if (!domain) { return res.status(400).json({ error: 'Falta indicar el dominio.' }); }
   if (!canAccessDomain(auth.user, domain)) { return res.status(403).json({ error: 'No tienes acceso a este dominio.' }); }

   try {
      const keywords: Keyword[] = await Keyword.findAll({ where: { domain } });
      const ids = keywords.map((k) => k.get('ID') as number);
      const daily: KeywordDaily[] = ids.length
         ? await KeywordDaily.findAll({ where: { keyword_id: { [Op.in]: ids } } })
         : [];

      const byKeyword = new Map<number, KeywordDaily[]>();
      daily.forEach((d) => {
         const id = d.get('keyword_id') as number;
         byKeyword.set(id, [...(byKeyword.get(id) || []), d]);
      });

      const rows: AiTrackingRow[] = keywords.map((k) => {
         const id = k.get('ID') as number;
         const days = (byKeyword.get(id) || [])
            .map((d) => ({
               date: d.get('date') as string,
               ai_cited: d.get('ai_cited') as number,
               ai_mentioned: d.get('ai_mentioned') as number,
               refs: d.get('ai_references') as string,
               text: d.get('ai_text') as string,
               local_pack: d.get('local_pack') as string,
               paa: d.get('paa') as string,
               serp_trust: d.get('serp_trust') as number | null,
            }))
            // por fecha real: ordenar estas claves como texto pone '2026-9-9' después de '2026-9-28'
            .sort((a, b) => parseKey(a.date) - parseKey(b.date));
         // Candidatos a "último dato": sin las filas no medidas (-3) ni las de página alterada (serp_trust 0).
         const usable = days.filter((d) => d.ai_cited !== AI_NOT_MEASURED && d.serp_trust !== 0);
         // el último día que tuvo resumen manda lo que se muestra arriba; si nunca hubo, la fila queda en -1
         const lastWithAi = [...usable].reverse().find((d) => d.ai_cited !== -1);
         const latest = lastWithAi || usable[usable.length - 1];
         // hay filas pero ninguna utilizable: es "no medido", no "no hubo resumen"
         const missing = days.length > 0 ? AI_NOT_MEASURED : -1;
         const trusted = days.length === 0 || days[days.length - 1].serp_trust !== 0;
         const lp = [...usable].reverse()
            .map((d) => parseJson<{ present?: boolean, position?: number }>(d.local_pack, {}))
            .find((o) => Object.keys(o).length > 0);
         const paaRow = [...usable].reverse().map((d) => parseJson<string[]>(d.paa, [])).find((a) => a.length > 0);
         const crudas = parseJson<AiOverviewReference[]>(latest?.refs, []);
         const texto = latest?.text || '';
         // de cada fuente: si además de citarla, el resumen la nombra por su nombre
         const references = crudas.map((r) => ({ ...r, mentioned: mentionState(texto, brandOf(r.domain)) === 1 }));
         const mine = references.find((r) => norm(r.domain) === norm(domain));

         return {
            keywordID: id,
            keyword: k.get('keyword') as string,
            country: k.get('country') as string,
            volume: (k.get('volume') as number) || 0,
            cited: latest ? latest.ai_cited : missing,
            mentioned: latest ? latest.ai_mentioned : missing,
            position: mine ? mine.position : 0,
            citedUrl: mine ? mine.url : '',
            references,
            text: texto,
            lastDate: latest?.date || '',
            localPack: { present: !!lp?.present, position: lp?.position || 0 },
            trusted,
            paa: paaRow || [],
            periods: citationPeriodsWeeks(days),
         };
      });

      return res.status(200).json({ rows });
   } catch (error) {
      console.log('[ERROR] Leyendo Tracking IA', error);
      return res.status(400).json({ error: 'No se pudo leer la información de IA.' });
   }
}
