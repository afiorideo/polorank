// PoloRank migration: adds serp_features (JSON list) and last_depth (results requested) to the keyword table.

module.exports = {
   up: (queryInterface, Sequelize) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const def = await queryInterface.describeTable('keyword');
            if (def && !def.serp_features) {
               const featuresCol = { type: Sequelize.DataTypes.STRING, defaultValue: '[]' };
               await queryInterface.addColumn('keyword', 'serp_features', featuresCol, { transaction: t });
            }
            if (def && !def.last_depth) {
               const depthCol = { type: Sequelize.DataTypes.INTEGER, defaultValue: 0 };
               await queryInterface.addColumn('keyword', 'last_depth', depthCol, { transaction: t });
            }
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
   down: (queryInterface) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const def = await queryInterface.describeTable('keyword');
            if (def && def.serp_features) {
               await queryInterface.removeColumn('keyword', 'serp_features', { transaction: t });
            }
            if (def && def.last_depth) {
               await queryInterface.removeColumn('keyword', 'last_depth', { transaction: t });
            }
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
};
