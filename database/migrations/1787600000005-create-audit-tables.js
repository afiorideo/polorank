// PoloRank migration: SEO audit module (Fase 1 — foundations).
// Four new tables plus one column on `domain`. Nothing existing is touched: the tracker, the cron and the
// keyword tables keep working exactly as before. Tables fill forward only; the past is never recalculated.

module.exports = {
   up: (queryInterface, Sequelize) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const tables = await queryInterface.showAllTables();

            // One row per audit execution.
            if (!tables.includes('audit_run')) {
               await queryInterface.createTable('audit_run', {
                  ID: { type: Sequelize.DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
                  domain: { type: Sequelize.DataTypes.STRING, allowNull: false },
                  started_at: { type: Sequelize.DataTypes.STRING, allowNull: false },
                  finished_at: { type: Sequelize.DataTypes.STRING, allowNull: true },
                  // running | ok | partial | error — 'running' doubles as the lock that prevents a second run
                  status: { type: Sequelize.DataTypes.STRING, allowNull: false, defaultValue: 'running' },
                  // 'cron' or 'user:<uid>'
                  triggered_by: { type: Sequelize.DataTypes.STRING, allowNull: false, defaultValue: 'cron' },
                  // business profile used for the weights: local | local_national | ecommerce | services
                  profile: { type: Sequelize.DataTypes.STRING, allowNull: false, defaultValue: 'local_national' },
                  pages_crawled: { type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
                  duration_ms: { type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
                  error: { type: Sequelize.DataTypes.TEXT, allowNull: false, defaultValue: '' },
               }, { transaction: t });
               await queryInterface.addIndex('audit_run', ['domain', 'started_at'], { transaction: t });
               await queryInterface.addIndex('audit_run', ['status'], { transaction: t });
            }

            // One row per check per run. This is the historical series.
            if (!tables.includes('audit_check_result')) {
               await queryInterface.createTable('audit_check_result', {
                  ID: { type: Sequelize.DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
                  run_id: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
                  domain: { type: Sequelize.DataTypes.STRING, allowNull: false },
                  // stable slug defined in code, e.g. 'onp.target.title'
                  check_id: { type: Sequelize.DataTypes.STRING, allowNull: false },
                  block: { type: Sequelize.DataTypes.STRING, allowNull: false },
                  // page the check refers to; empty when the check is site-wide
                  url: { type: Sequelize.DataTypes.STRING, allowNull: false, defaultValue: '' },
                  // pass | fail | partial | na | pending_review
                  status: { type: Sequelize.DataTypes.STRING, allowNull: false, defaultValue: 'na' },
                  // 0 · 0.5 (semi-automatic ceiling) · 1
                  score: { type: Sequelize.DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
                  // snapshot of the weight AT THE TIME OF THE RUN, so redefining a check never rewrites history
                  weight: { type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
                  // raw evidence as JSON: what was measured, so a verdict can always be audited
                  evidence: { type: Sequelize.DataTypes.TEXT, allowNull: false, defaultValue: '{}' },
                  // human review, when the check needs one
                  reviewed_at: { type: Sequelize.DataTypes.STRING, allowNull: true },
                  reviewed_by: { type: Sequelize.DataTypes.STRING, allowNull: false, defaultValue: '' },
                  review_note: { type: Sequelize.DataTypes.TEXT, allowNull: false, defaultValue: '' },
               }, { transaction: t });
               await queryInterface.addIndex('audit_check_result', ['run_id'], { transaction: t });
               await queryInterface.addIndex('audit_check_result', ['domain', 'check_id'], { transaction: t });
            }

            // Denormalised block scores, so painting the donuts is one cheap read.
            if (!tables.includes('audit_block_score')) {
               await queryInterface.createTable('audit_block_score', {
                  ID: { type: Sequelize.DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
                  run_id: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
                  domain: { type: Sequelize.DataTypes.STRING, allowNull: false },
                  block: { type: Sequelize.DataTypes.STRING, allowNull: false },
                  // the two numbers of the donut: what passed, and how much could actually be measured
                  compliance: { type: Sequelize.DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
                  coverage: { type: Sequelize.DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
                  // weight of this block in the global score, already corrected by evidence
                  weight: { type: Sequelize.DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
                  // which gate capped the block, when one did (e.g. 'noindex')
                  capped_by: { type: Sequelize.DataTypes.STRING, allowNull: false, defaultValue: '' },
                  checks_total: { type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
                  checks_measured: { type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
               }, { transaction: t });
               await queryInterface.addIndex('audit_block_score', ['run_id'], { transaction: t });
               await queryInterface.addIndex('audit_block_score', ['domain', 'block'], { transaction: t });
            }

            // One row per crawled page per run.
            if (!tables.includes('audit_page')) {
               await queryInterface.createTable('audit_page', {
                  ID: { type: Sequelize.DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
                  run_id: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
                  domain: { type: Sequelize.DataTypes.STRING, allowNull: false },
                  url: { type: Sequelize.DataTypes.STRING, allowNull: false },
                  status_code: { type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
                  // false when the fetch failed or the body was too small to trust: such a page is NEVER scored as 0
                  fetched_ok: { type: Sequelize.DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
                  title: { type: Sequelize.DataTypes.TEXT, allowNull: false, defaultValue: '' },
                  h1: { type: Sequelize.DataTypes.TEXT, allowNull: false, defaultValue: '' },
                  word_count: { type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
                  // clicks away from the home page
                  click_depth: { type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
                  indexable: { type: Sequelize.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
                  size_bytes: { type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
               }, { transaction: t });
               await queryInterface.addIndex('audit_page', ['run_id'], { transaction: t });
               await queryInterface.addIndex('audit_page', ['domain', 'url'], { transaction: t });
            }

            // Per-domain audit configuration (business profile, crawl limits, enabled blocks) as JSON.
            const domainCols = await queryInterface.describeTable('domain');
            if (!domainCols.audit_settings) {
               await queryInterface.addColumn('domain', 'audit_settings', {
                  type: Sequelize.DataTypes.TEXT, allowNull: false, defaultValue: '{}',
               }, { transaction: t });
            }
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
   down: (queryInterface) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const tables = await queryInterface.showAllTables();
            const drop = ['audit_page', 'audit_block_score', 'audit_check_result', 'audit_run'];
            for (const name of drop) {
               if (tables.includes(name)) {
                  // eslint-disable-next-line no-await-in-loop
                  await queryInterface.dropTable(name, { transaction: t });
               }
            }
            const domainCols = await queryInterface.describeTable('domain');
            if (domainCols.audit_settings) { await queryInterface.removeColumn('domain', 'audit_settings', { transaction: t }); }
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
};
