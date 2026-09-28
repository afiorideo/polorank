// PoloRank migration: el resumen con IA de Google, dentro del contexto diario de cada keyword.
// Solo agrega columnas. El bloque ai_overview ya viene en la respuesta de SERP que se paga hoy;
// hasta ahora se descartaba y solo se anotaba que existía.

module.exports = {
   up: (queryInterface, Sequelize) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const cols = await queryInterface.describeTable('keyword_daily');
            if (!cols.ai_cited) {
               // 1 = citado · 0 = hubo resumen y no lo citó · -1 = no hubo resumen (o no se pudo leer)
               // El -1 NO es un fallo: es lo que permite contar "oportunidades" en vez de días calendario.
               await queryInterface.addColumn('keyword_daily', 'ai_cited', {
                  type: Sequelize.DataTypes.INTEGER, allowNull: false, defaultValue: -1,
               }, { transaction: t });
            }
            if (!cols.ai_references) {
               // JSON: [{ position, source, domain, url, title }]
               await queryInterface.addColumn('keyword_daily', 'ai_references', {
                  type: Sequelize.DataTypes.TEXT, allowNull: false, defaultValue: '[]',
               }, { transaction: t });
            }
            if (!cols.ai_text) {
               await queryInterface.addColumn('keyword_daily', 'ai_text', {
                  type: Sequelize.DataTypes.TEXT, allowNull: false, defaultValue: '',
               }, { transaction: t });
            }
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
   /**
    * Deliberadamente no hace nada, y conviene saber por qué.
    *
    * Para quitar una columna en SQLite, Sequelize RECREA la tabla completa — y al recrearla pierde el
    * índice único compuesto (keyword_id, date), dejándolo solo sobre keyword_id. Probado el 2026-09-28:
    * falla con "UNIQUE constraint failed: keyword_daily_backup.keyword_id" porque cada keyword tiene
    * muchos días. Si llegara a completarse, destruiría la protección contra filas diarias duplicadas.
    *
    * Como estas tres columnas solo AGREGAN, dejarlas no cuesta nada ni afecta a ninguna consulta.
    * La vuelta atrás real es revertir el código con git: las columnas quedan sin usar y ya.
    */
   down: async () => {
      console.log('[MIGRACIÓN] La reversa de ai_overview no quita columnas a propósito: en SQLite eso recrearía');
      console.log('            keyword_daily y perdería el índice único (keyword_id, date). Revertir el código basta.');
   },
};
