// PoloRank migration: creates the api_usage table (one row per scraper API request, with its real cost).

module.exports = {
   up: (queryInterface, Sequelize) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const tables = await queryInterface.showAllTables();
            if (!tables.includes('api_usage')) {
               await queryInterface.createTable('api_usage', {
                  ID: { type: Sequelize.DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
                  created_at: { type: Sequelize.DataTypes.STRING, allowNull: false },
                  scraper: { type: Sequelize.DataTypes.STRING, allowNull: false, defaultValue: '' },
                  domain: { type: Sequelize.DataTypes.STRING, allowNull: false, defaultValue: '' },
                  keyword_id: { type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
                  keyword: { type: Sequelize.DataTypes.STRING, allowNull: false, defaultValue: '' },
                  depth: { type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
                  cost_usd: { type: Sequelize.DataTypes.DECIMAL(10, 6), allowNull: false, defaultValue: 0 },
                  triggered_by: { type: Sequelize.DataTypes.STRING, allowNull: false, defaultValue: 'cron' },
                  status: { type: Sequelize.DataTypes.STRING, allowNull: false, defaultValue: 'ok' },
               }, { transaction: t });
               await queryInterface.addIndex('api_usage', ['created_at'], { transaction: t });
               await queryInterface.addIndex('api_usage', ['domain'], { transaction: t });
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
            if (tables.includes('api_usage')) {
               await queryInterface.dropTable('api_usage', { transaction: t });
            }
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
};
