import ApiUsage from '../database/models/apiUsage';

export type UsageEntry = {
   scraper: string,
   domain: string,
   keywordID: number,
   keyword: string,
   depth: number,
   costUSD: number | undefined,
   triggeredBy: string,
   status: 'ok' | 'error',
};

/**
 * PoloRank — records one scraper API request in the api_usage table.
 * Never throws: a logging failure must not break the position update.
 */
export const logUsage = async (entry: UsageEntry): Promise<void> => {
   try {
      await ApiUsage.create({
         created_at: new Date().toJSON(),
         scraper: entry.scraper,
         domain: entry.domain,
         keyword_id: entry.keywordID,
         keyword: entry.keyword,
         depth: entry.depth,
         cost_usd: typeof entry.costUSD === 'number' ? entry.costUSD : 0,
         triggered_by: entry.triggeredBy || 'cron',
         status: entry.status,
      });
   } catch (error) {
      console.log('[ERROR] Registrando consumo de API', entry.keyword, error);
   }
};

export default logUsage;
