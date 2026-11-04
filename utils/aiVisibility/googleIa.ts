import { QueryTypes } from 'sequelize';
import Keyword from '../../database/models/keyword';
import KeywordDaily from '../../database/models/keywordDaily';
import Domain from '../../database/models/domain';
import db from '../../database/database';
import { extractAiOverview } from '../../scrapers/services/dataforseo';
import { aiCitedState } from '../dailySnapshot';
import { brandOf, mentionState, AI_DEFERRED } from '../aiTracking';
import { logUsage } from '../usage';
import { dfsCall } from './dfs';
import { organicHosts, serpTrust } from './trust';
import { PRICES } from './budget';
import { parseAiSettings } from './config';

const host = (u: string): string => (u || '').replace(/^https?:\/\//, '').replace(/^www\./i, '').split('/')[0].toLowerCase();

export const extractLocalPack = (items: any[], domain: string) => {
   const lp = (items || []).filter((i) => i.type === 'local_pack');
   const list = lp.map((i) => ({ title: i.title || '', domain: host(i.url || i.domain || ''), rating: i.rating?.value ?? null }));
   const target = host(domain);
   const brand = brandOf(domain);
   const idx = list.findIndex((x) => x.domain === target || (!!brand && (x.title || '').toLowerCase().includes(brand)));
   return { present: idx >= 0, position: idx >= 0 ? idx + 1 : 0, items: list };
};

export const extractPaa = (items: any[]): string[] => (items || [])
   .filter((i) => i.type === 'people_also_ask')
   .flatMap((i) => (i.items || []).map((q: any) => q.title).filter(Boolean));

/** Misma clave 'YYYY-M-D' en hora local del servidor que usa utils/refresh.ts. */
const dateKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** La marca configurada vive en domain.audit_settings (columna sin atributo en el modelo). */
const configuredBrand = async (domain: string): Promise<string> => {
   try {
      const rows: any[] = await db.query('SELECT audit_settings FROM domain WHERE domain = ?', { replacements: [domain], type: QueryTypes.SELECT });
      return JSON.parse(rows?.[0]?.audit_settings || '{}').brand || '';
   } catch { return ''; }
};

/** Una consulta de página completa. Devuelve el resultado y el costo; ok=false si falló. */
const fetchSerp = async (kw: any, creds: string, location: number, language: string) => {
   const r = await dfsCall('POST', '/serp/google/organic/live/advanced', creds, [{
      keyword: kw.keyword, language_code: language, location_code: location, device: kw.device === 'mobile' ? 'mobile' : 'desktop',
      os: kw.device === 'mobile' ? 'android' : 'windows', depth: 10,
   }]);
   return { ok: r.ok && !!r.task?.result?.[0], cost: r.cost, result: r.task?.result?.[0] };
};

/**
 * Google IA de un dominio: 1 consulta por palabra clave (+1 reintento si la página viene envenenada).
 * Escribe en la fila del día de keyword_daily solo los campos de IA y página; posición y URL no se tocan.
 */
export const runGoogleIa = async (domain: string, creds: string, triggeredBy: string) => {
   const dom = await Domain.findOne({ where: { domain } });
   const cfg = parseAiSettings(dom?.ai_settings, domain);
   const brand = await configuredBrand(domain);
   const keywords = await Keyword.findAll({ where: { domain } });
   let cost = 0; let untrusted = 0;
   for (const k of keywords) {
      const kw: any = k.get({ plain: true });
      let lastResult: any[] = [];
      try { const p = JSON.parse(kw.lastResult || '[]'); lastResult = Array.isArray(p) ? p : []; } catch { lastResult = []; }
      const serperHosts = lastResult.slice(0, 10).map((r: any) => host(r?.url));
      let trust: 0 | 1 | null = null; let res: any = null;
      for (let intento = 1; intento <= 2; intento += 1) {
         // eslint-disable-next-line no-await-in-loop
         const s = await fetchSerp(kw, creds, cfg.location_code, cfg.language_code);
         cost += s.cost;
         // eslint-disable-next-line no-await-in-loop
         await logUsage({ scraper: 'ai:google', domain, keywordID: kw.ID, keyword: kw.keyword, depth: 10, costUSD: s.cost || PRICES.google, triggeredBy, status: s.ok ? 'ok' : 'error' });
         if (!s.ok) { break; }
         res = s.result;
         trust = serpTrust(organicHosts(res.items || []), serperHosts);
         if (trust !== 0) { break; }
      }
      if (!res) { continue; }
      if (trust === 0) { untrusted += 1; }
      const ai = extractAiOverview({ tasks: [{ result: [res] }] });
      const values = {
         ai_cited: aiCitedState(ai, domain),
         ai_mentioned: ai?.deferred ? AI_DEFERRED : mentionState(ai ? ai.text : null, brandOf(domain, brand)),
         ai_references: JSON.stringify(ai?.references || []),
         ai_text: ai?.text || '',
         local_pack: JSON.stringify(extractLocalPack(res.items || [], domain)),
         paa: JSON.stringify(extractPaa(res.items || [])),
         serp_trust: trust,
      };
      const where = { keyword_id: kw.ID, date: dateKey(new Date()) };
      // eslint-disable-next-line no-await-in-loop
      const row = await KeywordDaily.findOne({ where });
      if (row) {
         // eslint-disable-next-line no-await-in-loop
         await row.update(values);
      } else {
         // eslint-disable-next-line no-await-in-loop
         await KeywordDaily.create({ ...where, ...values, position: kw.position || 0, url: kw.url || '', measured: false });
      }
   }
   return { keywords: keywords.length, cost, untrusted };
};
