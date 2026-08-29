/**
 * PoloRank — SQLite pragmas applied on startup.
 *
 * Why: the database shipped in `journal_mode = delete`, where a writer blocks every reader. With the daily scrape
 * writing 48 keywords in a row, any read from the UI could hit `SQLITE_BUSY`. WAL lets reads run while a write is in
 * flight, which the position tracking benefits from on its own — and is the prerequisite for ever adding a second writer.
 *
 * Why plain queries and not an `afterConnect` hook: that hook never fires on the SQLite dialect (verified against
 * Sequelize 6.37.7, both via constructor options and `addHook`), so a pragma placed there is silently ignored.
 *
 * `journal_mode` is persisted inside the database file, so once applied it survives every restart. `busy_timeout` is
 * per connection and resets to 1000 ms on reopen, so it is set here every boot; SQLite reuses a single connection for
 * the whole pool, so one call covers the process (verified under 12 concurrent queries).
 *
 * Never throws: a database that refuses a pragma must keep working in its previous mode rather than fail to open.
 */
import type { Sequelize } from 'sequelize-typescript';

/** How long a query waits for a lock before giving up, instead of failing instantly with SQLITE_BUSY. */
export const BUSY_TIMEOUT_MS = 5000;

export const PRAGMAS = ['PRAGMA journal_mode = WAL;', `PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};`];

export const applyPragmas = async (sequelize: Pick<Sequelize, 'query'>): Promise<void> => {
   for (const pragma of PRAGMAS) {
      try {
         // sequential on purpose: journal_mode must land before anything else touches the file
         // eslint-disable-next-line no-await-in-loop
         await sequelize.query(pragma);
      } catch (error) {
         console.log('[AVISO] No se pudo aplicar el pragma SQLite:', pragma, error instanceof Error ? error.message : error);
      }
   }
};

export default applyPragmas;
