// PoloRank migration: creates the user and login_code tables (email-code access with roles).

module.exports = {
   up: (queryInterface, Sequelize) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const tables = await queryInterface.showAllTables();
            if (!tables.includes('user')) {
               await queryInterface.createTable('user', {
                  ID: { type: Sequelize.DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
                  email: { type: Sequelize.DataTypes.STRING, allowNull: false, unique: true },
                  role: { type: Sequelize.DataTypes.STRING, allowNull: false, defaultValue: 'domain_user' },
                  domain_id: { type: Sequelize.DataTypes.INTEGER, allowNull: true },
                  active: { type: Sequelize.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
                  created_at: { type: Sequelize.DataTypes.STRING, allowNull: false },
                  last_login: { type: Sequelize.DataTypes.STRING, allowNull: true },
               }, { transaction: t });
            }
            if (!tables.includes('login_code')) {
               await queryInterface.createTable('login_code', {
                  ID: { type: Sequelize.DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
                  email: { type: Sequelize.DataTypes.STRING, allowNull: false },
                  code_hash: { type: Sequelize.DataTypes.STRING, allowNull: false },
                  expires_at: { type: Sequelize.DataTypes.STRING, allowNull: false },
                  attempts: { type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
                  used: { type: Sequelize.DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
                  created_at: { type: Sequelize.DataTypes.STRING, allowNull: false },
               }, { transaction: t });
               await queryInterface.addIndex('login_code', ['email'], { transaction: t });
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
            if (tables.includes('login_code')) { await queryInterface.dropTable('login_code', { transaction: t }); }
            if (tables.includes('user')) { await queryInterface.dropTable('user', { transaction: t }); }
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
};
