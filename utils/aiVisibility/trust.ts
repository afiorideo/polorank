const host = (u: string): string => (u || '').replace(/^https?:\/\//, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
const GOTO = /google\.[a-z.]+\/goto\?/i;

/** Dominios del top 10 orgánico de DataForSEO. Los goto toman el dominio de breadcrumb cuando es una URL. */
export const organicHosts = (items: any[]): string[] => (items || [])
   .filter((i) => i.type === 'organic')
   .sort((a, b) => (a.rank_group || 0) - (b.rank_group || 0))
   .slice(0, 10)
   .map((i) => {
      if (!GOTO.test(i.url || '')) { return host(i.url); }
      const b = (i.breadcrumb || '').split(' ')[0];
      return /^https?:\/\//.test(b) ? host(b) : '';
   })
   .filter(Boolean);

/**
 * ¿La página de DataForSEO es la real? Se compara con el top de Serper de la misma palabra clave.
 * Envenenada = aparece menos de la mitad de los dominios de Serper (regla de Nozzle adaptada).
 */
export const serpTrust = (dfsHosts: string[], serperHosts: string[]): 0 | 1 | null => {
   const ref = [...new Set(serperHosts.filter(Boolean))];
   if (ref.length === 0) { return null; }
   const got = new Set(dfsHosts);
   const share = ref.filter((h) => got.has(h)).length / ref.length;
   return share >= 0.5 ? 1 : 0;
};
