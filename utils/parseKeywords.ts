import Keyword from '../database/models/keyword';
import { parseKeywordScrape } from './depth';

/** PoloRank: serp_features is a JSON string list; tolerate legacy rows without the column. */
const parseFeatures = (raw: string | undefined | null): string[] => {
   if (!raw) { return []; }
   try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((f) => typeof f === 'string') : [];
   } catch (error) {
      return [];
   }
};

/**
 * Parses the SQL Keyword Model object to frontend consumable object.
 * @param {Keyword[]} allKeywords - Keywords to scrape
 * @returns {KeywordType[]}
 */
const parseKeywords = (allKeywords: Keyword[]) : KeywordType[] => {
   const parsedItems = allKeywords.map((keywrd:Keyword) => ({
         ...keywrd,
         history: JSON.parse(keywrd.history),
         tags: JSON.parse(keywrd.tags),
         lastResult: JSON.parse(keywrd.lastResult),
         lastUpdateError: keywrd.lastUpdateError !== 'false' && keywrd.lastUpdateError.includes('{') ? JSON.parse(keywrd.lastUpdateError) : false,
         serpFeatures: parseFeatures(keywrd.serp_features),
         lastDepth: Number.isFinite(keywrd.last_depth) ? keywrd.last_depth : 0,
         scrapeSettings: parseKeywordScrape(keywrd.settings),
      }));
   return parsedItems;
};

export default parseKeywords;
