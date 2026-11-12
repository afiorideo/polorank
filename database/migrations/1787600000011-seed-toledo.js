// PoloRank migration POLO-2026-11-12-01: alta de toledo.uy (cliente de Emignia en Uruguay), pedida por Fabián el 2026-11-12.
// Dominio + 9 palabras clave (una por página, Uruguay, celular, con URL objetivo) + Visibilidad IA (Uruguay,
// Gemini en Montevideo) con 5 prompts. Idempotente: no duplica nada si ya existe.
const DOMAIN = 'toledo.uy';
const KEYWORDS = [
   ['calefacción en montevideo', 'https://toledo.uy', 'inicio'],
   ['calefacción central', 'https://toledo.uy/calefaccion-central', 'calefacción central'],
   ['losa radiante', 'https://toledo.uy/losa-radiante', 'losa radiante'],
   ['bomba de calor', 'https://toledo.uy/bombas-de-calor', 'bombas de calor'],
   ['agua caliente central', 'https://toledo.uy/agua-caliente-central', 'agua caliente'],
   ['climatización de piscinas', 'https://toledo.uy/climatizacion-de-piscinas', 'piscinas'],
   ['generadores de vapor', 'https://toledo.uy/generadores-de-vapor', 'vapor'],
   ['instalaciones de gas', 'https://toledo.uy/instalaciones-de-gas', 'gas'],
   ['service de calderas', 'https://toledo.uy/servicio-tecnico', 'servicio técnico'],
];
const AI = {
   enabled: true,
   brand_variants: ['Toledo Termomecánica', 'Toledo Termomecanica'],
   brand_urls: ['toledo.uy'],
   competitors: [
      { name: 'CIR', variants: ['CIR Calefacción', 'circalefaccion'] },
      { name: 'Chichiraldi', variants: [] },
      { name: 'Gianni', variants: ['Gianni S.A.'] },
      { name: 'Climatización Integral', variants: ['Climatizacion Integral'] },
      { name: 'Buonafina', variants: ['Buonafina Calefacción'] },
   ],
   location_code: 2858,
language_code: 'es',
gemini_location_code: 1012872,
country_iso: 'UY',
};
const PROMPTS = [
   ['Empresas de calefacción central en Montevideo', ['calefacción central']],
   ['¿Qué empresa instala losa radiante en Montevideo?', ['losa radiante']],
   ['¿Quién instala bombas de calor para calefacción en Uruguay?', ['bombas de calor']],
   ['¿Quién hace climatización de piscinas en Montevideo?', ['piscinas']],
   ['¿Quién hace service de calderas en Montevideo?', ['servicio técnico']],
];

const DOMAIN_SQL = 'INSERT INTO domain (domain, slug, keywordCount, lastUpdated, added, tags, notification, notification_interval, '
   + 'notification_emails, scrape_strategy, scrape_pagination_limit, scrape_smart_full_fallback, subdomain_matching, ai_settings) '
   + "VALUES (?,?,0,?,?,?,1,?,?,'',0,0,'',?)";
const KEYWORD_SQL = 'INSERT INTO keyword (keyword, device, country, city, domain, lastUpdated, added, position, history, url, tags, '
   + "sticky, updating, target_url, lastUpdateError) VALUES (?,?,?,?,?,?,?,0,?,?,?,0,0,?,'false')";
const EXISTS_SQL = 'SELECT ID FROM keyword WHERE domain = ? AND keyword = ? AND device = ? AND country = ?';
const PROMPT_SQL = 'INSERT INTO ai_prompt (domain, prompt, tags, active, created_at) VALUES (?,?,?,1,?)';

module.exports = {
   up: (queryInterface) => queryInterface.sequelize.transaction(async (t) => {
      const q = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements, transaction: t });
      const now = new Date().toJSON();
      const [dom] = await q('SELECT ID, ai_settings FROM domain WHERE domain = ?', [DOMAIN]);
      if (!dom.length) {
         await q(DOMAIN_SQL, [DOMAIN, 'toledo-uy', now, now, '[]', 'daily', '', JSON.stringify(AI)]);
      } else if (!dom[0].ai_settings || dom[0].ai_settings === '{}') {
         await q('UPDATE domain SET ai_settings = ? WHERE domain = ?', [JSON.stringify(AI), DOMAIN]);
      }
      for (const [keyword, target, tag] of KEYWORDS) {
         // eslint-disable-next-line no-await-in-loop
         const [ex] = await q(EXISTS_SQL, [DOMAIN, keyword, 'mobile', 'UY']);
         if (!ex.length) {
            // eslint-disable-next-line no-await-in-loop
            await q(KEYWORD_SQL, [keyword, 'mobile', 'UY', '', DOMAIN, now, now, '{}', '', JSON.stringify([tag]), target]);
         }
      }
      const [[{ n }]] = await q('SELECT COUNT(*) AS n FROM ai_prompt WHERE domain = ?', [DOMAIN]);
      if (n === 0) {
         for (const [prompt, tags] of PROMPTS) {
            // eslint-disable-next-line no-await-in-loop
            await q(PROMPT_SQL, [DOMAIN, prompt, JSON.stringify(tags), now]);
         }
      }
      console.log('[MIGRACIÓN] toledo.uy cargado: dominio, 9 palabras clave y 5 prompts de IA');
   }),
   down: async () => { console.log('[MIGRACIÓN] La reversa no borra toledo.uy: se elimina desde el panel.'); },
};
