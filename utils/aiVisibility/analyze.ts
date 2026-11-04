import { flat, prose, MIN_BRAND_LENGTH } from '../aiTracking';
import type { ParsedAnswer } from './engines';
import type { AiDomainSettings } from './config';

export type AnswerAnalysis = { mentioned: 0 | 1, cited: 0 | 1, position: number, brands: string[] };

const OWN = '__own__';

/** Índice de la primera aparición de alguna variante en el texto aplanado, o -1. */
const firstIndex = (flatText: string, variants: string[]): number => {
   const idx = variants.map(flat).filter((v) => v.length >= MIN_BRAND_LENGTH).map((v) => flatText.indexOf(v)).filter((i) => i >= 0);
   return idx.length ? Math.min(...idx) : -1;
};

const matches = (name: string, variants: string[]): boolean => {
   const n = flat(name);
   return variants.map(flat).some((v) => v.length >= MIN_BRAND_LENGTH && n.includes(v));
};

const citesUs = (url: string, brandUrls: string[]): boolean => {
   const u = (url || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
   return brandUrls.some((b) => {
      const x = b.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
      return x.includes('/') ? u.startsWith(x) : (u.split('/')[0] === x || u.split('/')[0].endsWith(`.${x}`));
   });
};

/**
 * "Te nombra" = la marca aparece en la prosa. `prose()` quita marcadores de cita y URLs peladas, pero
 * conserva la etiqueta de un enlace markdown: `[ammo.cl](https://ammo.cl/)` cuenta como nombrada,
 * porque el modelo eligió escribir esa palabra al lector. Una URL pelada no cuenta (eso es "te cita").
 */
export const analyzeAnswer = (p: ParsedAnswer, cfg: AiDomainSettings): AnswerAnalysis => {
   const text = flat(prose(p.text));
   const mentioned: 0 | 1 = firstIndex(text, cfg.brand_variants) >= 0 ? 1 : 0;
   const cited: 0 | 1 = p.sources.some((s) => citesUs(s.url, cfg.brand_urls)) ? 1 : 0;

   let ordered: string[];
   if (p.entities.length) {
      // ChatGPT ya entrega las marcas en orden: se normalizan al nombre propio / del competidor configurado
      ordered = p.entities.map((e) => {
         if (matches(e, cfg.brand_variants)) { return OWN; }
         const c = cfg.competitors.find((x) => matches(e, [x.name, ...x.variants]));
         return c ? c.name : e;
      });
   } else {
      const found = [{ name: OWN, i: firstIndex(text, cfg.brand_variants) },
         ...cfg.competitors.map((c) => ({ name: c.name, i: firstIndex(text, [c.name, ...c.variants]) }))]
         .filter((x) => x.i >= 0).sort((a, b) => a.i - b.i);
      ordered = found.map((x) => x.name);
   }
   ordered = ordered.filter((x, i) => ordered.indexOf(x) === i);
   const pos = ordered.indexOf(OWN);
   return {
      mentioned,
      cited,
      position: mentioned && pos >= 0 ? pos + 1 : 0,
      brands: ordered.map((x) => (x === OWN ? cfg.brand_variants[0] : x)),
   };
};

/** Marcas que ChatGPT nombró y que no son la propia ni un competidor configurado. */
export const newCompetitors = (entities: string[], cfg: AiDomainSettings): string[] => entities
   .filter((e) => !matches(e, cfg.brand_variants))
   .filter((e) => !cfg.competitors.some((c) => matches(e, [c.name, ...c.variants])));
