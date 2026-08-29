// PoloRank migration: daily SERP context per keyword (keyword_daily) and monthly search volume (keyword_volume).
// The existing `keyword.history` JSON is untouched — this is a new layer that only fills forward.

module.exports = {
   up: (queryInterface, Sequelize) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const tables = await queryInterface.showAllTables();
            if (!tables.includes('keyword_daily')) {
               await queryInterface.createTable('keyword_daily', {
                  ID: { type: Sequelize.DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
                  keyword_id: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
                  // 'YYYY-M-D', same key format as keyword.history
                  date: { type: Sequelize.DataTypes.STRING, allowNull: false },
                  position: { type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
                  target_position: { type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
                  // Which page of the tracked domain actually ranked that day
                  url: { type: Sequelize.DataTypes.STRING, allowNull: false, defaultValue: '' },
                  // JSON array, e.g. ["local_pack","shopping"]
                  serp_features: { type: Sequelize.DataTypes.TEXT, allowNull: false, defaultValue: '[]' },
                  // How deep we looked that day: without it a position of 0 cannot be interpreted afterwards
                  depth: { type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
                  // false when the scrape failed: the position was carried over, not measured
                  measured: { type: Sequelize.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
                  // JSON array of the top 20: [{ position, url, title }]
                  serp_top: { type: Sequelize.DataTypes.TEXT, allowNull: false, defaultValue: '[]' },
               }, { transaction: t });
               await queryInterface.addIndex('keyword_daily', ['keyword_id', 'date'], { unique: true, transaction: t });
               await queryInterface.addIndex('keyword_daily', ['date'], { transaction: t });
            }
            if (!tables.includes('keyword_volume')) {
               await queryInterface.createTable('keyword_volume', {
                  ID: { type: Sequelize.DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
                  keyword_id: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
                  // 'YYYY-MM'
                  month: { type: Sequelize.DataTypes.STRING, allowNull: false },
                  volume: { type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
               }, { transaction: t });
               await queryInterface.addIndex('keyword_volume', ['keyword_id', 'month'], { unique: true, transaction: t });
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
            if (tables.includes('keyword_daily')) { await queryInterface.dropTable('keyword_daily', { transaction: t }); }
            if (tables.includes('keyword_volume')) { await queryInterface.dropTable('keyword_volume', { transaction: t }); }
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
};
