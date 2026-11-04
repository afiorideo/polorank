// PoloRank migration: prompts iniciales de Visibilidad IA aprobados por Fabián el 2026-11-04 (spec §12).
// Encendido gradual: solo ammo.cl queda enabled. Los demás quedan cargados y apagados.
const D = {
   'ammo.cl': {
      cfg: { enabled: true, brand_variants: ['Ammo', 'Ammo Store'], brand_urls: ['ammo.cl', 'instagram.com/ammostorechile'],
         competitors: [{ name: 'Armario de la Karo', variants: [] }, { name: 'Blanka Atelier', variants: ['Blanka'] },
            { name: 'Yaskari Novias y Fiestas', variants: ['Yaskari'] }, { name: 'Lady Lorenz', variants: [] },
            { name: 'Divina Novias', variants: [] }, { name: "Vestidos D'Fiesta", variants: ['DFiesta'] }],
         location_code: 2152, language_code: 'es', gemini_location_code: 20153, country_iso: 'CL' },
      prompts: [
         ['¿Qué tiendas en Temuco venden vestidos de fiesta bonitos y de buena calidad?', ['venta']],
         ['¿Dónde encuentro vestidos de gala en Temuco?', ['gala']],
         ['¿Dónde puedo arrendar un vestido de fiesta en Temuco?', ['arriendo']],
         ['¿Dónde compro un vestido para mi graduación en Temuco?', ['graduación']],
         ['¿Dónde encuentro un vestido para la fiesta de fin de año de mi empresa en Temuco?', ['fin de año']],
      ],
   },
   'mavae.cl': {
      cfg: { enabled: false, brand_variants: ['Mavae'], brand_urls: ['mavae.cl'], competitors: [], location_code: 2152, language_code: 'es', country_iso: 'CL' },
      prompts: [
         ['¿Qué empresas de regalos corporativos recomiendas en Chile?', ['regalos corporativos']],
         ['¿Dónde mando a hacer merchandising corporativo con el logo de mi empresa en Chile?', ['merchandising']],
         ['¿Qué proveedor hace bolsas personalizadas con logo en Chile?', ['bolsas']],
         ['Necesito regalos corporativos personalizados para clientes, ¿qué empresa en Santiago me recomiendas?', ['personalizados']],
         ['¿Qué regalos corporativos de Navidad puedo dar a mis clientes y dónde los compro en Chile?', ['navidad']],
      ],
   },
   'maderasfresard.com': {
      cfg: { enabled: false, brand_variants: ['Fresard', 'Maderas Fresard'], brand_urls: ['maderasfresard.com'], competitors: [], location_code: 2152, language_code: 'es', country_iso: 'CL' },
      prompts: [
         ['¿Dónde compro madera de roble en el sur de Chile?', ['roble']],
         ['¿Qué aserraderos venden maderas del sur de Chile al por mayor?', ['mayorista']],
         ['¿Dónde puedo comprar madera de raulí en Chile?', ['raulí']],
         ['¿Quién vende madera de coihue en la Araucanía?', ['coihue']],
         ['¿Dónde compro madera de pino oregón seca en Chile?', ['pino oregón']],
      ],
   },
   'emignia.com': {
      cfg: { enabled: false, brand_variants: ['Emignia'], brand_urls: ['emignia.com'], competitors: [], location_code: 2152, language_code: 'es', country_iso: 'CL' },
      prompts: [
         ['¿Qué agencia SEO recomiendas en Chile?', ['seo']],
         ['¿Qué agencia de marketing digital en Chile me recomiendas para una pyme?', ['marketing digital']],
         ['¿Qué empresa recomiendas para hacer el diseño de la página web de mi empresa en Chile?', ['diseño web']],
         ['¿Qué agencia puede posicionar mi negocio en Google y en ChatGPT en Chile?', ['seo ia']],
         ['Qual agência de SEO você recomenda para minha empresa?', ['brasil'], { location_code: 2076, language_code: 'pt', country_iso: 'BR' }],
      ],
   },
   'thetravellab.cl': {
      cfg: { enabled: false, brand_variants: ['The Travel Lab', 'TheTravelLab'], brand_urls: ['thetravellab.cl'], competitors: [], location_code: 2152, language_code: 'es', country_iso: 'CL' },
      prompts: [
         ['¿Qué agencia de viajes en Chile recomiendas para comprar un paquete a Brasil?', ['brasil']],
         ['¿Dónde compro un paquete a Río de Janeiro desde Chile con vuelo y hotel?', ['rio']],
         ['¿Qué agencia de viajes en Chile es confiable para viajar al extranjero?', ['agencia']],
         ['¿Dónde encuentro paquetes a Florianópolis desde Santiago?', ['florianópolis']],
         ['Quiero ir a Brasil en verano con mi familia, ¿qué agencia en Chile me arma el viaje?', ['familia']],
      ],
   },
   'thetravellab.com.br': {
      cfg: { enabled: false, brand_variants: ['The Travel Lab', 'TheTravelLab'], brand_urls: ['thetravellab.com.br'], competitors: [], location_code: 2076, language_code: 'pt', country_iso: 'BR' },
      prompts: [
         ['Qual agência de viagem você recomenda para uma viagem para o Chile?', ['chile']],
         ['Onde compro um pacote de viagem para o Chile com hotel e passeios?', ['pacote']],
         ['Qual agência vende pacote para Santiago do Chile saindo do Brasil?', ['santiago']],
         ['Vale a pena conhecer Pucón no Chile? Qual agência organiza a viagem?', ['pucón']],
         ['Quero viajar para o Chile com minha família, qual agência monta o roteiro?', ['família']],
      ],
   },
};

module.exports = {
   up: (queryInterface) => queryInterface.sequelize.transaction(async (t) => {
      const now = new Date().toJSON();
      for (const [domain, { cfg, prompts }] of Object.entries(D)) {
         // eslint-disable-next-line no-await-in-loop
         const [dom] = await queryInterface.sequelize.query('SELECT ai_settings FROM domain WHERE domain = ?', { replacements: [domain], transaction: t });
         if (!dom.length) { console.log(`[MIGRACIÓN] ${domain} no existe, se omite`); continue; }
         if (!dom[0].ai_settings || dom[0].ai_settings === '{}') {
            // eslint-disable-next-line no-await-in-loop
            await queryInterface.sequelize.query('UPDATE domain SET ai_settings = ? WHERE domain = ?', { replacements: [JSON.stringify(cfg), domain], transaction: t });
         }
         // eslint-disable-next-line no-await-in-loop
         const [[{ n }]] = await queryInterface.sequelize.query('SELECT COUNT(*) AS n FROM ai_prompt WHERE domain = ?', { replacements: [domain], transaction: t });
         if (n > 0) { continue; }
         for (const [prompt, tags, o = {}] of prompts) {
            // eslint-disable-next-line no-await-in-loop
            await queryInterface.sequelize.query(
               'INSERT INTO ai_prompt (domain, prompt, tags, active, location_code, language_code, country_iso, created_at) VALUES (?,?,?,1,?,?,?,?)',
               { replacements: [domain, prompt, JSON.stringify(tags), o.location_code || null, o.language_code || null, o.country_iso || null, now], transaction: t },
            );
         }
      }
      console.log('[MIGRACIÓN] Visibilidad IA: prompts iniciales cargados (solo ammo.cl encendido)');
   }),
   down: async () => { console.log('[MIGRACIÓN] La reversa no borra prompts: se apagan desde la configuración.'); },
};
