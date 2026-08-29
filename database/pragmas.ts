/**
 * PoloRank — SQLite pragmas applied to every connection.
 *
 * Why: the database shipped in `journal_mode = delete`, where a writer blocks every reader. With the daily scrape
 * writing 48 keywords in a row, any read from the UI could hit `SQLITE_BUSY`. WAL lets reads run while a write is in
 * flight, which the position tracking benefits from on its own — and is the prerequisite for ever adding a second writer.
 *
 * `journal_mode` is persisted in the database file (set once, kept forever); `busy_timeout` is per connection and must
 * be set every time, so both live here.
 *
 * Never throws: a database that refuses a pragma (a filesystem without shared memory, for instance) must keep working
 * in its previous mode rather than fail to open.
 */

/** How long a query waits for a lock before giving up, instead of failing instantly with SQLITE_BUSY. */
const BUSY_TIMEOUT_MS = 5000;

type SqliteConnection = { run: (sql: string, cb: (err: Error | null) => void) => void };

const run = (conn: SqliteConnection, sql: string): Promise<void> => new Promise((resolve) => {
   try {
      conn.run(sql, (err) => {
         if (err) { console.log('[AVISO] No se pudo aplicar el pragma SQLite:', sql, err.message); }
         resolve();
      });
   } catch (error) {
      console.log('[AVISO] No se pudo aplicar el pragma SQLite:', sql, error);
      resolve();
   }
});

export const applyPragmas = async (conn: unknown): Promise<void> => {
   const sqliteConn = conn as SqliteConnection;
   if (!sqliteConn || typeof sqliteConn.run !== 'function') { return; }
   await run(sqliteConn, 'PRAGMA journal_mode = WAL;');
   await run(sqliteConn, `PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};`);
};

export default applyPragmas;
