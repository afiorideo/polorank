import { applyPragmas } from '../../database/pragmas';

/** Conexión sqlite falsa que registra las sentencias recibidas. */
const fakeConn = (behaviour: 'ok' | 'error' | 'throw' = 'ok') => {
   const sqls: string[] = [];
   const run = (sql: string, cb: (err: Error | null) => void) => {
      sqls.push(sql);
      if (behaviour === 'throw') { throw new Error('conexión rota'); }
      cb(behaviour === 'error' ? new Error('no soportado') : null);
   };
   return { sqls, run };
};

describe('database/pragmas (PoloRank)', () => {
   beforeEach(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
   afterEach(() => { jest.restoreAllMocks(); });

   it('activa WAL y fija el busy_timeout en cada conexión', async () => {
      const conn = fakeConn();
      await applyPragmas(conn);
      expect(conn.sqls).toEqual(['PRAGMA journal_mode = WAL;', 'PRAGMA busy_timeout = 5000;']);
   });

   it('no rompe la conexión si el motor rechaza un pragma', async () => {
      const conn = fakeConn('error');
      await expect(applyPragmas(conn)).resolves.toBeUndefined();
      expect(conn.sqls).toHaveLength(2);
   });

   it('no rompe la conexión si el driver lanza', async () => {
      await expect(applyPragmas(fakeConn('throw'))).resolves.toBeUndefined();
   });

   it('ignora una conexión que no sabe ejecutar sentencias', async () => {
      await expect(applyPragmas({})).resolves.toBeUndefined();
      await expect(applyPragmas(null)).resolves.toBeUndefined();
   });
});
