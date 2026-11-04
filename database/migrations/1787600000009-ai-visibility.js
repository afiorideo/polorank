// PoloRank migration: Visibilidad IA (spec 2026-11-04).
// 1) domain.ai_settings · 2) keyword_daily.local_pack/paa/serp_trust · 3) tablas ai_prompt/ai_run/ai_answer
// 4) Los días refrescados por un proveedor SIN IA (Serper) guardaron ai_cited = -1 ("no hubo resumen"), que es
//    falso: no se midió. Se pasan a -3 (no medido).
module.exports = {
   up: (queryInterface, Sequelize) => queryInterface.sequelize.transaction(async (t) => {
      const T = Sequelize.DataTypes;
      const dom = await queryInterface.describeTable('domain');
      if (!dom.ai_settings) {
         await queryInterface.addColumn('domain', 'ai_settings', { type: T.TEXT, allowNull: true, defaultValue: '{}' }, { transaction: t });
      }
      const kd = await queryInterface.describeTable('keyword_daily');
      if (!kd.local_pack) { await queryInterface.addColumn('keyword_daily', 'local_pack', { type: T.TEXT, allowNull: false, defaultValue: '{}' }, { transaction: t }); }
      if (!kd.paa) { await queryInterface.addColumn('keyword_daily', 'paa', { type: T.TEXT, allowNull: false, defaultValue: '[]' }, { transaction: t }); }
      if (!kd.serp_trust) { await queryInterface.addColumn('keyword_daily', 'serp_trust', { type: T.INTEGER, allowNull: true }, { transaction: t }); }

      const tablas = await queryInterface.showAllTables();
      const id = { type: T.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true };
      if (!tablas.includes('ai_prompt')) {
         await queryInterface.createTable('ai_prompt', {
            ID: id,
domain: { type: T.STRING, allowNull: false },
prompt: { type: T.STRING(500), allowNull: false },
            tags: { type: T.TEXT, allowNull: false, defaultValue: '[]' },
active: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
            location_code: { type: T.INTEGER, allowNull: true },
language_code: { type: T.STRING, allowNull: true },
            country_iso: { type: T.STRING, allowNull: true },
created_at: { type: T.STRING, allowNull: false },
         }, { transaction: t });
      }
      if (!tablas.includes('ai_run')) {
         await queryInterface.createTable('ai_run', {
            ID: id,
started_at: { type: T.STRING, allowNull: false },
finished_at: { type: T.STRING, allowNull: true },
            triggered_by: { type: T.STRING, allowNull: false, defaultValue: 'cron' },
scope: { type: T.STRING, allowNull: false, defaultValue: 'all' },
            status: { type: T.STRING, allowNull: false, defaultValue: 'pending' },
            est_cost_usd: { type: T.DECIMAL(10, 6), allowNull: false, defaultValue: 0 },
cost_usd: { type: T.DECIMAL(10, 6), allowNull: false, defaultValue: 0 },
         }, { transaction: t });
      }
      if (!tablas.includes('ai_answer')) {
         await queryInterface.createTable('ai_answer', {
            ID: id,
run_id: { type: T.INTEGER, allowNull: false },
prompt_id: { type: T.INTEGER, allowNull: false },
            domain: { type: T.STRING, allowNull: false },
engine: { type: T.STRING, allowNull: false },
rep: { type: T.INTEGER, allowNull: false },
            week: { type: T.STRING, allowNull: false },
task_id: { type: T.STRING, allowNull: false, defaultValue: '' },
            status: { type: T.STRING, allowNull: false, defaultValue: 'pending' },
            mentioned: { type: T.INTEGER, allowNull: false, defaultValue: 0 },
cited: { type: T.INTEGER, allowNull: false, defaultValue: 0 },
            position: { type: T.INTEGER, allowNull: false, defaultValue: 0 },
            brands: { type: T.TEXT, allowNull: false, defaultValue: '[]' },
sources: { type: T.TEXT, allowNull: false, defaultValue: '[]' },
            fan_out: { type: T.TEXT, allowNull: false, defaultValue: '[]' },
text: { type: T.TEXT, allowNull: false, defaultValue: '' },
            raw: { type: T.TEXT, allowNull: false, defaultValue: '' },
cost_usd: { type: T.DECIMAL(10, 6), allowNull: false, defaultValue: 0 },
            error: { type: T.STRING, allowNull: false, defaultValue: '' },
created_at: { type: T.STRING, allowNull: false },
         }, { transaction: t });
         await queryInterface.addIndex('ai_answer', ['domain', 'week'], { transaction: t });
         await queryInterface.addIndex('ai_answer', ['status'], { transaction: t });
      }

      // 4) -1 → -3 en días sin refresco de DataForSEO. api_usage SOLO registra pedidos a DataForSEO
      //    (utils/refresh.ts loguea únicamente si depth es numérico); los días de Serper nunca quedan ahí. Por eso la
      //    regla es: ai_cited = -1 y NO existe fila api_usage scraper='dataforseo' de esa keyword ese día.
      //    keyword_daily.date es 'YYYY-M-D' (sin ceros); api_usage.created_at es ISO, así que su fecha se pasa a la
      //    forma sin ceros para comparar en una sola sentencia.
      const sinIa = `FROM keyword_daily
          WHERE ai_cited = -1
          AND NOT EXISTS (
             SELECT 1 FROM api_usage u
             WHERE u.scraper = 'dataforseo' AND u.keyword_id = keyword_daily.keyword_id
             AND substr(u.created_at, 1, 4) || '-' || CAST(substr(u.created_at, 6, 2) AS INTEGER) || '-' || CAST(substr(u.created_at, 9, 2) AS INTEGER) = keyword_daily.date
          )`;
      const [[{ n: cambiadas }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) AS n ${sinIa}`, { transaction: t });
      await queryInterface.sequelize.query(
         `UPDATE keyword_daily SET ai_cited = -3, ai_mentioned = -3 WHERE ID IN (SELECT ID ${sinIa})`,
         { transaction: t },
      );
      console.log(`[MIGRACIÓN] Visibilidad IA: ${cambiadas} días pasados de "no hubo resumen" a "no medido"`);
   }),
   down: async () => {
      console.log('[MIGRACIÓN] Visibilidad IA: la reversa no quita columnas ni tablas (SQLite recrearía keyword_daily). Revertir el código basta.');
   },
};
