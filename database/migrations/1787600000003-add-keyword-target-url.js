// PoloRank migration: "URL objetivo" por keyword — target_url (nullable), target_position, target_history.
// Also converts the legacy path tags ("/landing/") created during the first keyword loads into target_url.

module.exports = {
   up: (queryInterface, Sequelize) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const def = await queryInterface.describeTable('keyword');
            if (def && !def.target_url) {
               await queryInterface.addColumn('keyword', 'target_url', { type: Sequelize.DataTypes.STRING, allowNull: true }, { transaction: t });
            }
            if (def && !def.target_position) {
               await queryInterface.addColumn('keyword', 'target_position', { type: Sequelize.DataTypes.INTEGER, defaultValue: 0 }, { transaction: t });
            }
            if (def && !def.target_history) {
               await queryInterface.addColumn('keyword', 'target_history', { type: Sequelize.DataTypes.STRING, defaultValue: '{}' }, { transaction: t });
            }
            // legacy: a single tag starting with "/" was used as "target page" → becomes the real target_url
            const [rows] = await queryInterface.sequelize.query('SELECT ID, domain, tags, target_url FROM keyword', { transaction: t });
            for (const row of rows) {
               if (row.target_url) { continue; }
               let tags = [];
               try { tags = JSON.parse(row.tags || '[]'); } catch (e) { tags = []; }
               const pathTag = Array.isArray(tags) ? tags.find((tag) => typeof tag === 'string' && tag.startsWith('/')) : null;
               if (!pathTag) { continue; }
               const host = String(row.domain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
               const targetUrl = `https://${host}${pathTag}`;
               const remaining = JSON.stringify(tags.filter((tag) => tag !== pathTag));
               await queryInterface.sequelize.query(
                  'UPDATE keyword SET target_url = :targetUrl, tags = :tags WHERE ID = :id',
                  { replacements: { targetUrl, tags: remaining, id: row.ID }, transaction: t },
               );
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
            for (const col of ['target_url', 'target_position', 'target_history']) {
               if (def && def[col]) { await queryInterface.removeColumn('keyword', col, { transaction: t }); }
            }
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
};
