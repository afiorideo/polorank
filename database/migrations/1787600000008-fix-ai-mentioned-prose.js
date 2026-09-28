// PoloRank migration: recalcular `ai_mentioned` buscando la marca SOLO en la prosa del resumen.
//
// La migración anterior (…007) buscaba la marca en el texto crudo, que incluye los marcadores de cita
// `[[n]](https://marca.com/...)`. Como el marcador lleva la URL adentro, todo dominio citado quedaba
// también "nombrado" y la columna "¿Te nombra?" era una copia de "¿Te cita?".
// No pide nada a la API: el texto ya está guardado en `ai_text`.

/** Espejo de utils/aiTracking.ts — la migración no puede importar TypeScript. */
const brandOf = (domain, configured) => {
   const manual = (configured || '').trim();
   if (manual) { return manual.toLowerCase(); }
   return (domain || '').replace(/^https?:\/\//, '').replace(/^www\./i, '').split('.')[0].toLowerCase();
};
const prose = (text) => (text || '').replace(/\[\[\d+\]\]\([^)]*\)/g, ' ').replace(/https?:\/\/\S+/g, ' ');
const flat = (text) => (text || '').toLowerCase().normalize('NFD')
   .replace(/[̀-ͯ]/g, '')
   .replace(/[^a-z0-9]+/g, '');
const MIN_BRAND_LENGTH = 4;

module.exports = {
   up: (queryInterface) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const [rows] = await queryInterface.sequelize.query(
               `SELECT kd.ID, kd.ai_text, kd.ai_mentioned, k.domain, d.audit_settings
                  FROM keyword_daily kd
                  JOIN keyword k ON k.ID = kd.keyword_id
             LEFT JOIN domain d ON d.domain = k.domain
                 WHERE kd.ai_cited != -1`,
               { transaction: t },
            );
            let corregidas = 0;
            for (const row of rows) {
               let marca = '';
               try { marca = (JSON.parse(row.audit_settings || '{}').brand) || ''; } catch (e) { marca = ''; }
               const aguja = flat(brandOf(row.domain, marca));
               let estado = -1;
               if (aguja.length >= MIN_BRAND_LENGTH) { estado = flat(prose(row.ai_text)).includes(aguja) ? 1 : 0; }
               if (estado !== row.ai_mentioned) {
                  // eslint-disable-next-line no-await-in-loop
                  await queryInterface.sequelize.query(
                     'UPDATE keyword_daily SET ai_mentioned = ? WHERE ID = ?',
                     { replacements: [estado, row.ID], transaction: t },
                  );
                  corregidas += 1;
               }
            }
            console.log(`[MIGRACIÓN] ai_mentioned recalculada sobre la prosa: ${corregidas} filas corregidas de ${rows.length}`);
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
   /** Recalcular no se revierte: el valor anterior era el equivocado. */
   down: async () => {
      console.log('[MIGRACIÓN] La reversa no restaura los ai_mentioned viejos a propósito: eran falsos positivos.');
   },
};
