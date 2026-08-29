import { applyPragmas, PRAGMAS, BUSY_TIMEOUT_MS } from '../../database/pragmas';

const fakeDb = (behaviour: 'ok' | 'reject' | 'throw' = 'ok') => {
   const sqls: string[] = [];
   const query = jest.fn(async (sql: string) => {
      sqls.push(sql);
      if (behaviour === 'throw') { throw new Error('base caída'); }
      if (behaviour === 'reject') { return Promise.reject(new Error('pragma no soportado')); }
      return [[], []] as unknown;
   });
   return { sqls, query };
};

describe('database/pragmas (PoloRank)', () => {
   beforeEach(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
   afterEach(() => { jest.restoreAllMocks(); });

   it('activa WAL y fija el busy_timeout, en ese orden', async () => {
      const db = fakeDb();
      await applyPragmas(db as never);
      expect(db.sqls).toEqual(['PRAGMA journal_mode = WAL;', `PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};`]);
      expect(PRAGMAS[0]).toContain('journal_mode');
   });

   it('sigue con el segundo pragma aunque el primero falle', async () => {
      const db = fakeDb('reject');
      await expect(applyPragmas(db as never)).resolves.toBeUndefined();
      expect(db.sqls).toHaveLength(2);
   });

   it('nunca rechaza: un pragma rechazado no puede impedir que la app arranque', async () => {
      await expect(applyPragmas(fakeDb('throw') as never)).resolves.toBeUndefined();
   });
});
