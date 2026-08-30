/**
 * PoloRank — the checks that only this tool can run, because only this tool knows which page was SUPPOSED to rank.
 * Everything here reads from data the tracker already collects and pays for; none of it costs an extra request.
 */
import type { AuditCheck, AuditInput, CheckVerdict } from '../types';

/** Below this ratio the title is aimed at a keyword that is worth a fraction of what the page could target. */
export const MIN_VALUE_RATIO = 0.2;

const norm = (url: string): string => url.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();

/**
 * Does Google rank the page we chose, or a different one?
 * The single most useful check in the module: it catches Google replacing a landing with the home, which looks
 * like success in the position column (the domain still ranks) while the optimised page gets no traffic at all.
 */
export const targetReachable: AuditCheck = {
   id: 'arq.target.reachable',
   block: 'architecture',
   kind: 'auto',
   title: 'Google rankea la URL objetivo',
   help: 'Si Google muestra una página distinta de la que definiste, tu landing no recibe el tráfico aunque el dominio aparezca.',
   weight: 3,
   run: (input: AuditInput): CheckVerdict[] => input.keywords.map((kw) => {
      if (!kw.targetUrl) {
         return {
            status: 'na',
            score: 0,
            url: '',
            evidence: { keyword: kw.keyword, motivo: 'La keyword no tiene URL objetivo asignada' },
         };
      }
      if (!kw.rankingUrl) {
         return {
            status: 'na',
            score: 0,
            url: kw.targetUrl,
            evidence: { keyword: kw.keyword, motivo: 'El dominio no aparece en los resultados revisados', objetivo: kw.targetUrl },
         };
      }
      const coincide = norm(kw.rankingUrl) === norm(kw.targetUrl);
      return {
         status: coincide ? 'pass' : 'fail',
         score: coincide ? 1 : 0,
         url: kw.targetUrl,
         evidence: { keyword: kw.keyword, objetivo: kw.targetUrl, rankea: kw.rankingUrl, posicion: kw.position },
      };
   }),
};

/**
 * Is the title aimed at the most valuable keyword available for that page?
 * A page can pass every cosmetic on-page test and still target a phrase nobody searches.
 *
 * SCOPE, and it matters: this only compares among the keywords BEING TRACKED that point at the page. It cannot
 * know about an opportunity nobody added — a site whose title targets a 20/month phrase while a 1.900/month one
 * exists in the market passes this check if that bigger phrase is not being tracked. Catching that needs
 * candidates from Keyword Planner or Search Console, which is a separate check (`onp.title.opportunity`).
 *
 * Matching is by phrase containment, which is the right semantics: a title reading "Maderas del Sur de Chile"
 * does target "maderas del sur".
 */
export const targetTitle: AuditCheck = {
   id: 'onp.target.title',
   block: 'onpage',
   kind: 'auto',
   title: 'El title apunta a la keyword de mayor volumen en seguimiento',
   help: 'Compara el title contra la keyword de más búsquedas entre las que seguís para esa página. No ve oportunidades que no estés midiendo.',
   weight: 3,
   run: (input: AuditInput): CheckVerdict[] => {
      const byPage = new Map<string, typeof input.keywords>();
      input.keywords.filter((k) => k.targetUrl && k.volume > 0).forEach((k) => {
         const key = norm(k.targetUrl);
         byPage.set(key, [...(byPage.get(key) || []), k]);
      });

      return [...byPage.entries()].map(([key, kws]) => {
         const page = input.pages.find((p) => norm(p.url) === key);
         if (!page || !page.fetchedOk || !page.title) {
            return {
               status: 'na',
               score: 0,
               url: kws[0].targetUrl,
               evidence: { motivo: 'No se pudo leer el title de la página', pagina: kws[0].targetUrl },
            };
         }
         const title = page.title.toLowerCase();
         const best = kws.reduce((a, b) => (b.volume > a.volume ? b : a));
         const inTitle = kws.filter((k) => title.includes(k.keyword.toLowerCase()));
         const bestInTitle = inTitle.reduce<typeof kws[0] | null>((a, b) => (!a || b.volume > a.volume ? b : a), null);

         const evidence = {
            title: page.title,
            mejorDisponible: { keyword: best.keyword, volumen: best.volume },
            enElTitle: bestInTitle ? { keyword: bestInTitle.keyword, volumen: bestInTitle.volume } : null,
            candidatas: kws.map((k) => ({ keyword: k.keyword, volumen: k.volume })),
         };
         if (!bestInTitle) {
            return { status: 'fail', score: 0, url: page.url, evidence: { ...evidence, motivo: 'Ninguna keyword objetivo aparece en el title' } };
         }
         const ratio = best.volume > 0 ? bestInTitle.volume / best.volume : 0;
         const pass = ratio >= MIN_VALUE_RATIO;
         return {
            status: pass ? 'pass' : 'fail',
            score: pass ? 1 : 0,
            url: page.url,
            evidence: { ...evidence, ratio: Math.round(ratio * 100) / 100, minimo: MIN_VALUE_RATIO },
         };
      });
   },
};

/**
 * Two of our own URLs competing in the same top 20 — cannibalisation measured, not theorised.
 * Only detectable because the daily snapshot stores the whole SERP.
 */
export const cannibalisation: AuditCheck = {
   id: 'arq.cannibalisation',
   block: 'architecture',
   kind: 'auto',
   title: 'Sin canibalización en la SERP',
   help: 'Dos páginas propias compitiendo por la misma búsqueda se restan fuerza entre sí.',
   weight: 2,
   run: (input: AuditInput): CheckVerdict[] => input.keywords.map((kw) => {
      if (!kw.serpTop || kw.serpTop.length === 0) {
         return { status: 'na', score: 0, evidence: { keyword: kw.keyword, motivo: 'Sin SERP guardada para esa búsqueda' } };
      }
      const propias = kw.serpTop.filter((r) => norm(r.url).startsWith(norm(input.domain)));
      const limpio = propias.length <= 1;
      return {
         status: limpio ? 'pass' : 'fail',
         score: limpio ? 1 : 0,
         url: propias[0]?.url || '',
         evidence: { keyword: kw.keyword, propiasEnTop20: propias.map((p) => ({ posicion: p.position, url: p.url })) },
      };
   }),
};

export default [targetReachable, targetTitle, cannibalisation];
