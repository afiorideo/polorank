import { performance } from 'perf_hooks';
import { setTimeout as sleep } from 'timers/promises';
import { RefreshResult, removeFromRetryQueue, retryScrape, scrapeKeywordWithStrategy } from './scraper';
import parseKeywords from './parseKeywords';
import Keyword from '../database/models/keyword';
import { logUsage } from './usage';
import { recordDailySnapshot, recordMonthlyVolume } from './dailySnapshot';
import { findTargetPosition } from './targetUrl';

/**
 * Refreshes the Keywords position by Scraping Google Search Result by
 * Determining whether the keywords should be scraped in Parallel or not
 * @param {Keyword[]} rawKeyword - Keywords to scrape
 * @param {SettingsType} settings - The App Settings that contain the Scraper settings
 * @param {DomainType[]} domains - Optional domain list for per-domain strategy overrides
 * @param {string} triggeredBy - PoloRank: who originated the refresh ('cron' or 'user:<ID>'), for the usage log
 * @returns {Promise}
 */
const refreshAndUpdateKeywords = async (
   rawKeyword:Keyword[],
   settings:SettingsType,
   domains?: DomainType[],
   triggeredBy: string = 'cron',
): Promise<KeywordType[]> => {
   const keywords:KeywordType[] = rawKeyword.map((el) => el.get({ plain: true }));
   if (!rawKeyword || rawKeyword.length === 0) { return []; }
   const start = performance.now();
   const updatedKeywords: KeywordType[] = [];

   if (['scrapingant', 'serpapi', 'searchapi'].includes(settings.scraper_type)) {
      const refreshedResults = await refreshParallel(keywords, settings, domains);
      if (refreshedResults.length > 0) {
         for (const keyword of rawKeyword) {
            const refreshedKeywordData = refreshedResults.find((k) => k && k.ID === keyword.ID);
            if (refreshedKeywordData) {
               const updatedKeyword = await updateKeywordPosition(keyword, refreshedKeywordData, settings, triggeredBy);
               updatedKeywords.push(updatedKeyword);
            }
         }
      }
   } else {
      for (const keyword of rawKeyword) {
         console.log('START SCRAPE: ', keyword.keyword);
         const keywordPlain = keyword.get({ plain: true }) as KeywordType;
         const domainSettings = domains?.find((d) => d.domain === keywordPlain.domain);
         const updatedKeyword = await refreshAndUpdateKeyword(keyword, settings, domainSettings, triggeredBy);
         updatedKeywords.push(updatedKeyword);
         if (keywords.length > 0 && settings.scrape_delay && settings.scrape_delay !== '0') {
            await sleep(parseInt(settings.scrape_delay, 10));
         }
      }
   }

   const end = performance.now();
   console.log(`time taken: ${end - start}ms`);
   return updatedKeywords;
};

/**
 * Scrape Serp for given keyword and update the position in DB.
 * @param {Keyword} keyword - Keywords to scrape
 * @param {SettingsType} settings - The App Settings that contain the Scraper settings
 * @param {DomainType} domainSettings - Optional domain-level settings override
 * @returns {Promise<KeywordType>}
 */
const refreshAndUpdateKeyword = async (
   keyword: Keyword,
   settings: SettingsType,
   domainSettings?: DomainType,
   triggeredBy: string = 'cron',
): Promise<KeywordType> => {
   const currentKeyword = keyword.get({ plain: true });
   const refreshedKeywordData = await scrapeKeywordWithStrategy(currentKeyword, settings, domainSettings);
   const updatedKeyword = refreshedKeywordData ? await updateKeywordPosition(keyword, refreshedKeywordData, settings, triggeredBy) : currentKeyword;
   return updatedKeyword;
};

/**
 * Processes the scraped data for the given keyword and updates the keyword serp position in DB.
 * @param {Keyword} keywordRaw - Keywords to Update
 * @param {RefreshResult} updatedKeyword - scraped Data for that Keyword
 * @param {SettingsType} settings - The App Settings that contain the Scraper settings
 * @returns {Promise<KeywordType>}
 */
export const updateKeywordPosition = async (
   keywordRaw:Keyword,
   updatedKeyword: RefreshResult,
   settings: SettingsType,
   triggeredBy: string = 'cron',
): Promise<KeywordType> => {
   const keywordParsed = parseKeywords([keywordRaw.get({ plain: true })]);
      const keyword = keywordParsed[0];
      // const updatedKeyword = refreshed;
      let updated = keyword;

      if (updatedKeyword && keyword) {
         const newPos = updatedKeyword.position;
         const { history } = keyword;
         const theDate = new Date();
         const dateKey = `${theDate.getFullYear()}-${theDate.getMonth() + 1}-${theDate.getDate()}`;
         history[dateKey] = newPos;

         // PoloRank: depth-based scrapers report the requested depth and the SERP features found
         const depthMeta = typeof updatedKeyword.depth === 'number'
            ? { serpFeatures: updatedKeyword.serpFeatures || [], lastDepth: updatedKeyword.depth }
            : {};
         // PoloRank: "URL objetivo" — same SERP, second lookup (only when the keyword has a target and the scrape succeeded)
         const targetMeta: { targetPosition?: number, targetHistory?: KeywordHistory } = {};
         if (keyword.targetUrl && !updatedKeyword.error) {
            const targetHistory: KeywordHistory = { ...(keyword.targetHistory || {}) };
            const targetPos = findTargetPosition(keyword.targetUrl, updatedKeyword.result);
            targetHistory[dateKey] = targetPos;
            targetMeta.targetPosition = targetPos;
            targetMeta.targetHistory = targetHistory;
         }
         // PoloRank: full context of this day's check. `measured` is false when the scrape failed — in that case the
         // scraper returns the PREVIOUS position, so the history point is carried over, not measured, and must be flagged.
         await recordDailySnapshot({
            keywordID: keyword.ID,
            date: dateKey,
            position: newPos,
            targetPosition: targetMeta.targetPosition ?? keyword.targetPosition ?? 0,
            url: updatedKeyword.url,
            serpFeatures: updatedKeyword.serpFeatures || [],
            depth: typeof updatedKeyword.depth === 'number' ? updatedKeyword.depth : 0,
            measured: !updatedKeyword.error,
            serpTop: updatedKeyword.result,
         });
         await recordMonthlyVolume(keyword.ID, dateKey, keyword.volume);

         const updatedVal = {
            position: newPos,
            ...depthMeta,
            ...targetMeta,
            updating: false,
            url: updatedKeyword.url,
            lastResult: updatedKeyword.result,
            history,
            lastUpdated: updatedKeyword.error ? keyword.lastUpdated : theDate.toJSON(),
            lastUpdateError: updatedKeyword.error
               ? JSON.stringify({ date: theDate.toJSON(), error: `${updatedKeyword.error}`, scraper: settings.scraper_type })
               : 'false',
         };

         // If failed, Add to Retry Queue Cron
         if (updatedKeyword.error && settings?.scrape_retry) {
            await retryScrape(keyword.ID);
         } else {
            await removeFromRetryQueue(keyword.ID);
         }

         // Update the Keyword Position in Database
         try {
            type ExtraVal = { serpFeatures?: string[], lastDepth?: number, targetPosition?: number, targetHistory?: KeywordHistory };
            const { serpFeatures, lastDepth, targetPosition, targetHistory, ...dbVal } = updatedVal as typeof updatedVal & ExtraVal;
            await keywordRaw.update({
               ...dbVal,
               ...(typeof lastDepth === 'number' ? { serp_features: JSON.stringify(serpFeatures || []), last_depth: lastDepth } : {}),
               ...(typeof targetPosition === 'number'
                  ? { target_position: targetPosition, target_history: JSON.stringify(targetHistory || {}) } : {}),
               lastResult: Array.isArray(updatedKeyword.result) ? JSON.stringify(updatedKeyword.result) : updatedKeyword.result,
               history: JSON.stringify(history),
            });
            console.log('[SUCCESS] Updating the Keyword: ', keyword.keyword);
            updated = { ...keyword, ...updatedVal, lastUpdateError: JSON.parse(updatedVal.lastUpdateError) };
         } catch (error) {
            console.log('[ERROR] Updating SERP for Keyword', keyword.keyword, error);
         }

         // PoloRank: record the API request (and its real cost) for the usage panel
         if (typeof updatedKeyword.depth === 'number') {
            await logUsage({
               scraper: settings.scraper_type,
               domain: keyword.domain,
               keywordID: keyword.ID,
               keyword: keyword.keyword,
               depth: updatedKeyword.depth,
               costUSD: updatedKeyword.cost,
               triggeredBy,
               status: updatedKeyword.error ? 'error' : 'ok',
            });
         }
      }

      return updated;
};

/**
 * Scrape Google Keyword Search Result in Parallel.
 * @param {KeywordType[]} keywords - Keywords to scrape
 * @param {SettingsType} settings - The App Settings that contain the Scraper settings
 * @param {DomainType[]} domains - Optional domain list for per-domain strategy overrides
 * @returns {Promise}
 */
const refreshParallel = async (keywords:KeywordType[], settings:SettingsType, domains?: DomainType[]) : Promise<RefreshResult[]> => {
   const promises: Promise<RefreshResult>[] = keywords.map((keyword) => {
      const domainSettings = domains?.find((d) => d.domain === keyword.domain);
      return scrapeKeywordWithStrategy(keyword, settings, domainSettings);
   });

   const results = await Promise.allSettled(promises);
   const fulfilled = results.filter((r): r is PromiseFulfilledResult<RefreshResult> => r.status === 'fulfilled');

   return fulfilled.map((r) => r.value);
};

export default refreshAndUpdateKeywords;
