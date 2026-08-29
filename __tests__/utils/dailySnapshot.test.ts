import { monthOf, topOfSerp, SERP_TOP_N, recordDailySnapshot, recordMonthlyVolume } from '../../utils/dailySnapshot';
import KeywordDaily from '../../database/models/keywordDaily';
import KeywordVolume from '../../database/models/keywordVolume';

jest.mock('../../database/models/keywordDaily', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../../database/models/keywordVolume', () => ({ findOne: jest.fn(), create: jest.fn() }));

const daily = KeywordDaily as unknown as { findOne: jest.Mock, create: jest.Mock };
const volume = KeywordVolume as unknown as { findOne: jest.Mock, create: jest.Mock };

const serp = Array.from({ length: 100 }, (_, i) => ({ position: i + 1, url: `https://sitio${i + 1}.cl/`, title: `Sitio ${i + 1}` }));

describe('utils/dailySnapshot (PoloRank)', () => {
   beforeEach(() => { jest.clearAllMocks(); });

   it('monthOf normaliza la clave del historial a YYYY-MM', () => {
      expect(monthOf('2026-8-29')).toBe('2026-08');
      expect(monthOf('2026-12-1')).toBe('2026-12');
   });

   it('topOfSerp guarda 20 resultados, descarta los saltados y conserva posición, url y título', () => {
      const top = topOfSerp(serp);
      expect(SERP_TOP_N).toBe(20);
      expect(top).toHaveLength(20);
      expect(top[0]).toEqual({ position: 1, url: 'https://sitio1.cl/', title: 'Sitio 1' });
      expect(top[19].position).toBe(20);
      const conSaltados = [{ position: 1, url: '', title: '', skipped: true }, ...serp.slice(0, 3)];
      expect(topOfSerp(conSaltados)).toHaveLength(3);
      expect(topOfSerp(undefined)).toEqual([]);
   });

   it('recordDailySnapshot guarda el contexto completo del día', async () => {
      daily.findOne.mockResolvedValue(null);
      await recordDailySnapshot({
         keywordID: 7,
         date: '2026-8-29',
         position: 10,
         targetPosition: 0,
         url: 'https://goaraucania.cl/',
         serpFeatures: ['people_also_ask', 'local_pack'],
         depth: 20,
         measured: true,
         serpTop: serp,
      });
      const saved = daily.create.mock.calls[0][0];
      expect(saved.keyword_id).toBe(7);
      expect(saved.date).toBe('2026-8-29');
      expect(saved.url).toBe('https://goaraucania.cl/');
      expect(JSON.parse(saved.serp_features)).toEqual(['people_also_ask', 'local_pack']);
      expect(saved.depth).toBe(20);
      expect(saved.measured).toBe(true);
      expect(JSON.parse(saved.serp_top)).toHaveLength(20);
   });

   it('marca measured=false cuando el scrape falló (la posición se arrastra, no se midió)', async () => {
      daily.findOne.mockResolvedValue(null);
      await recordDailySnapshot({
         keywordID: 7, date: '2026-8-30', position: 10, targetPosition: 0, url: '', serpFeatures: [], depth: 20, measured: false, serpTop: [],
      });
      expect(daily.create.mock.calls[0][0].measured).toBe(false);
   });

   it('si el día ya existe lo actualiza en vez de duplicarlo', async () => {
      const update = jest.fn();
      daily.findOne.mockResolvedValue({ update });
      await recordDailySnapshot({
         keywordID: 7, date: '2026-8-29', position: 8, targetPosition: 0, url: '', serpFeatures: [], depth: 20, measured: true, serpTop: [],
      });
      expect(update).toHaveBeenCalled();
      expect(daily.create).not.toHaveBeenCalled();
   });

   it('nunca lanza: un fallo guardando el detalle no puede romper la actualización de posición', async () => {
      daily.findOne.mockRejectedValue(new Error('db caída'));
      await expect(recordDailySnapshot({
         keywordID: 7, date: '2026-8-29', position: 8, targetPosition: 0, url: '', serpFeatures: [], depth: 20, measured: true, serpTop: [],
      })).resolves.toBeUndefined();
   });

   it('recordMonthlyVolume guarda el volumen del mes e ignora el volumen desconocido', async () => {
      volume.findOne.mockResolvedValue(null);
      await recordMonthlyVolume(7, '2026-8-29', 2400);
      expect(volume.create).toHaveBeenCalledWith({ keyword_id: 7, month: '2026-08', volume: 2400 });
      await recordMonthlyVolume(7, '2026-8-29', 0);
      expect(volume.create).toHaveBeenCalledTimes(1);
   });
});
