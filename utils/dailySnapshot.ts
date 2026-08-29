import KeywordDaily from '../database/models/keywordDaily';
import KeywordVolume from '../database/models/keywordVolume';

/** How many SERP results are kept per day. Two pages: our keywords live around the top-10 border. */
export const SERP_TOP_N = 20;

export type DailySnapshot = {
   keywordID: number,
   /** 'YYYY-M-D', same key format as keyword.history */
   date: string,
   position: number,
   targetPosition: number,
   url: string,
   serpFeatures: string[],
   depth: number,
   /** false when the scrape failed: the position was carried over, not measured */
   measured: boolean,
   serpTop: KeywordLastResult[],
};

/** 'YYYY-MM' for the month a history key belongs to. */
export const monthOf = (dateKey: string): string => {
   const [y, m] = dateKey.split('-');
   return `${y}-${String(parseInt(m, 10)).padStart(2, '0')}`;
};

/** Top N of the SERP, keeping only what is worth storing (position, url, title) and dropping skipped entries. */
export const topOfSerp = (result: KeywordLastResult[] | undefined | null, n: number = SERP_TOP_N): KeywordLastResult[] => {
   if (!Array.isArray(result)) { return []; }
   return result
      .filter((r) => r && !r.skipped && r.url)
      .slice(0, n)
      .map((r) => ({ position: r.position, url: r.url, title: r.title || '' }));
};

/**
 * PoloRank — stores the full context of one day's check (one row per keyword per day, replaced if the day is re-checked).
 * Never throws: losing a snapshot must not break the position update.
 */
export const recordDailySnapshot = async (snap: DailySnapshot): Promise<void> => {
   try {
      const where = { keyword_id: snap.keywordID, date: snap.date };
      const values = {
         ...where,
         position: snap.position,
         target_position: snap.targetPosition,
         url: snap.url || '',
         serp_features: JSON.stringify(snap.serpFeatures || []),
         depth: snap.depth || 0,
         measured: snap.measured,
         serp_top: JSON.stringify(topOfSerp(snap.serpTop)),
      };
      const existing = await KeywordDaily.findOne({ where });
      if (existing) { await existing.update(values); } else { await KeywordDaily.create(values); }
   } catch (error) {
      console.log('[ERROR] Guardando el detalle diario de', snap.keywordID, error);
   }
};

/** PoloRank — stores the search volume of the month, so seasonality is not overwritten. */
export const recordMonthlyVolume = async (keywordID: number, dateKey: string, volume: number): Promise<void> => {
   if (!volume || volume <= 0) { return; }
   try {
      const where = { keyword_id: keywordID, month: monthOf(dateKey) };
      const existing = await KeywordVolume.findOne({ where });
      if (existing) { await existing.update({ volume }); } else { await KeywordVolume.create({ ...where, volume }); }
   } catch (error) {
      console.log('[ERROR] Guardando el volumen mensual de', keywordID, error);
   }
};
