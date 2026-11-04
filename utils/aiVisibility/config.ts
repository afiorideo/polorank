/** PoloRank — Visibilidad IA: configuración por dominio (columna domain.ai_settings). */
export type AiCompetitor = { name: string, variants: string[] };
export type AiDomainSettings = {
   enabled: boolean, brand_variants: string[], brand_urls: string[], competitors: AiCompetitor[],
   location_code: number, language_code: string, gemini_location_code?: number, country_iso: string,
};
export type AiTarget = { location_code: number, gemini_location_code: number, language_code: string, country_iso: string };

const bare = (d: string): string => (d || '').replace(/^https?:\/\//, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();

export const parseAiSettings = (raw: string | null | undefined, domain: string): AiDomainSettings => {
   let o: Partial<AiDomainSettings> = {};
   try { o = JSON.parse(raw || '{}') || {}; } catch { o = {}; }
   const host = bare(domain);
   return {
      enabled: o.enabled === true,
      brand_variants: o.brand_variants && o.brand_variants.length ? o.brand_variants : [host.split('.')[0]],
      brand_urls: o.brand_urls && o.brand_urls.length ? o.brand_urls : [host],
      competitors: Array.isArray(o.competitors) ? o.competitors : [],
      location_code: o.location_code || 2152,
      language_code: o.language_code || 'es',
      gemini_location_code: o.gemini_location_code || undefined,
      country_iso: o.country_iso || 'CL',
   };
};

export const targetFor = (
   cfg: AiDomainSettings, p: { location_code?: number | null, language_code?: string | null, country_iso?: string | null },
): AiTarget => {
   const location = p.location_code || cfg.location_code;
   return {
      location_code: location,
      // la región de Gemini solo aplica cuando el prompt no fija otro país
      gemini_location_code: p.location_code ? p.location_code : (cfg.gemini_location_code || location),
      language_code: p.language_code || cfg.language_code,
      country_iso: p.country_iso || cfg.country_iso,
   };
};
