// PoloRank migration POLO-2026-11-12-02: las 9 palabras clave de toledo.uy se cargaron en celular y Fabián las
// quería en escritorio. Pasa a escritorio las de celular y limpia la posición y el historial (eran de celular).
// Si ya existe la misma palabra en escritorio, no toca la de celular. Solo afecta a toledo.uy.
const DOMAIN = 'toledo.uy';
const PASAR_SQL = "UPDATE keyword SET device = 'desktop', position = 0, history = '{}', url = '', lastResult = '[]', "
   + "serp_features = '[]', last_depth = 0, lastUpdateError = 'false' WHERE ID = ?";
const MELLIZA_SQL = "SELECT ID FROM keyword WHERE domain = ? AND keyword = ? AND country = ? AND device = 'desktop'";

module.exports = {
   up: (queryInterface) => queryInterface.sequelize.transaction(async (t) => {
      const q = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements, transaction: t });
      const [filas] = await q("SELECT ID, keyword, country FROM keyword WHERE domain = ? AND device = 'mobile'", [DOMAIN]);
      let pasadas = 0;
      for (const { ID, keyword, country } of filas) {
         // eslint-disable-next-line no-await-in-loop
         const [melliza] = await q(MELLIZA_SQL, [DOMAIN, keyword, country]);
         if (!melliza.length) {
            // eslint-disable-next-line no-await-in-loop
            await q(PASAR_SQL, [ID]);
            pasadas += 1;
         }
      }
      console.log(`[MIGRACIÓN] toledo.uy: ${pasadas} de ${filas.length} palabras clave pasadas a escritorio`);
   }),
   down: (queryInterface) => queryInterface.sequelize.query(
      "UPDATE keyword SET device = 'mobile' WHERE domain = ? AND device = 'desktop'",
      { replacements: [DOMAIN] },
   ),
};
