// PoloRank migration: distinguir "te cita como fuente" de "te nombra en el texto".
// Solo agrega una columna, y rellena las filas que ya tienen texto guardado: el dato se puede
// recalcular leyendo `ai_text`, sin pedirle nada a la API.

/** Igual que utils/aiTracking.ts: marca del dominio, o la configurada en audit_settings. */
const brandOf = (domain, configured) => {
   const manual = (configured || '').trim();
   if (manual) { return manual.toLowerCase(); }
   return (domain || '').replace(/^https?:\/\//, '').replace(/^www\./i, '').split('.')[0].toLowerCase();
};

module.exports = {
   up: (queryInterface, Sequelize) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const cols = await queryInterface.describeTable('keyword_daily');
            if (!cols.ai_mentioned) {
               // misma semántica que ai_cited: 1 la nombra · 0 hubo resumen y no la nombra · -1 no hubo resumen
               await queryInterface.addColumn('keyword_daily', 'ai_mentioned', {
                  type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: -1,
               }, { transaction: t });
            }

            // relleno: las filas con resumen guardado ya tienen el texto, no hace falta volver a consultar
            const [rows] = await queryInterface.sequelize.query(
               `SELECT kd.ID, kd.ai_text, k.domain, d.audit_settings
                  FROM keyword_daily kd
                  JOIN keyword k ON k.ID = kd.keyword_id
             LEFT JOIN domain d ON d.domain = k.domain
                 WHERE kd.ai_cited != -1`,
               { transaction: t },
            );
            let rellenadas = 0;
            for (const row of rows) {
               let marca = '';
               try { marca = (JSON.parse(row.audit_settings || '{}').brand) || ''; } catch (e) { marca = ''; }
               const brand = brandOf(row.domain, marca);
               const texto = (row.ai_text || '').toLowerCase();
               let estado = -1;
               if (brand.length >= 4) { estado = texto.includes(brand) ? 1 : 0; }
               // eslint-disable-next-line no-await-in-loop
               await queryInterface.sequelize.query(
                  'UPDATE keyword_daily SET ai_mentioned = ? WHERE ID = ?',
                  { replacements: [estado, row.ID], transaction: t },
               );
               rellenadas += 1;
            }
            console.log(`[MIGRACIÓN] ai_mentioned calculada para ${rellenadas} filas ya guardadas`);
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
   /** No quita la columna: en SQLite eso recrea la tabla y pierde el índice único (keyword_id, date). */
   down: async () => {
      console.log('[MIGRACIÓN] La reversa de ai_mentioned no quita la columna a propósito: en SQLite eso recrearía');
      console.log('            keyword_daily y perdería el índice único (keyword_id, date). Revertir el código basta.');
   },
};
