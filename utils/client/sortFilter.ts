/**
 * Sorrt Keywords by user's given input.
 * @param {KeywordType[]} theKeywords - The Keywords to sort.
 * @param {string} sortBy - The sort method.
 * @returns {KeywordType[]}
 */
const changeOf = (k: KeywordType, compareDays: number): number | null => {
   const key = `d${compareDays}` as 'd7' | 'd30' | 'd60' | 'd90';
   const change = k.stats?.changes?.[key]?.change;
   return change === null || change === undefined ? null : change;
};

/**
 * Sort by change. Keywords without a number (entered / left / no data) always go last, whichever direction is asked,
 * because they have no magnitude to rank — among themselves the current position breaks the tie.
 */
const byChange = (compareDays: number, dir: 1 | -1) => (a: KeywordType, b: KeywordType): number => {
   const ca = changeOf(a, compareDays);
   const cb = changeOf(b, compareDays);
   if (ca === null && cb === null) { return (a.position || 111) - (b.position || 111); }
   if (ca === null) { return 1; }
   if (cb === null) { return -1; }
   return dir * (cb - ca);
};

export const sortKeywords = (theKeywords:KeywordType[], sortBy:string, scDataType?: string, compareDays: number = 7) : KeywordType[] => {
   let sortedItems: KeywordType[] = [];
   const keywords = theKeywords.map((k) => ({ ...k, position: k.position === 0 ? 111 : k.position }));
   switch (sortBy) {
      // PoloRank: change vs. N days ago (positive = improved) and best position
      case 'change_desc':
            sortedItems = theKeywords.sort(byChange(compareDays, 1));
            break;
      case 'change_asc':
            sortedItems = theKeywords.sort(byChange(compareDays, -1));
            break;
      case 'best_asc':
            sortedItems = theKeywords.sort((a, b) => (a.stats?.best?.position || 111) - (b.stats?.best?.position || 111));
            break;
      case 'date_asc':
            sortedItems = theKeywords.sort((a: KeywordType, b: KeywordType) => new Date(b.added).getTime() - new Date(a.added).getTime());
            break;
      case 'date_desc':
            sortedItems = theKeywords.sort((a: KeywordType, b: KeywordType) => new Date(a.added).getTime() - new Date(b.added).getTime());
            break;
      case 'pos_asc':
            sortedItems = keywords.sort((a: KeywordType, b: KeywordType) => (b.position > a.position ? 1 : -1));
            sortedItems = sortedItems.map((k) => ({ ...k, position: k.position === 111 ? 0 : k.position }));
            break;
      case 'pos_desc':
            sortedItems = keywords.sort((a: KeywordType, b: KeywordType) => (a.position > b.position ? 1 : -1));
            sortedItems = sortedItems.map((k) => ({ ...k, position: k.position === 111 ? 0 : k.position }));
            break;
      case 'alpha_asc':
            sortedItems = theKeywords.sort((a: KeywordType, b: KeywordType) => (b.keyword > a.keyword ? 1 : -1));
            break;
      case 'alpha_desc':
            sortedItems = theKeywords.sort((a: KeywordType, b: KeywordType) => (a.keyword > b.keyword ? 1 : -1));
         break;
      case 'vol_asc':
            sortedItems = theKeywords.sort((a: KeywordType, b: KeywordType) => (b.volume - a.volume));
            break;
      case 'vol_desc':
            sortedItems = theKeywords.sort((a: KeywordType, b: KeywordType) => (a.volume - b.volume));
            break;
      case 'imp_desc':
            if (scDataType) {
                  sortedItems = theKeywords.sort((a: KeywordType, b: KeywordType) => {
                  const bImpressionData = b.scData?.impressions[scDataType as keyof KeywordSCDataChild] || 0;
                  const aImpressionData = a.scData?.impressions[scDataType as keyof KeywordSCDataChild] || 0;
                  return aImpressionData > bImpressionData ? 1 : -1;
               });
            }
            break;
      case 'imp_asc':
            if (scDataType) {
                  sortedItems = theKeywords.sort((a: KeywordType, b: KeywordType) => {
                  const bImpressionData = b.scData?.impressions[scDataType as keyof KeywordSCDataChild] || 0;
                  const aImpressionData = a.scData?.impressions[scDataType as keyof KeywordSCDataChild] || 0;
                  return bImpressionData > aImpressionData ? 1 : -1;
               });
            }
         break;
      case 'visits_desc':
            if (scDataType) {
                  sortedItems = theKeywords.sort((a: KeywordType, b: KeywordType) => {
                  const bVisitsData = b.scData?.visits[scDataType as keyof KeywordSCDataChild] || 0;
                  const aVisitsData = a.scData?.visits[scDataType as keyof KeywordSCDataChild] || 0;
                  return aVisitsData > bVisitsData ? 1 : -1;
               });
            }
            break;
      case 'visits_asc':
            if (scDataType) {
                  sortedItems = theKeywords.sort((a: KeywordType, b: KeywordType) => {
                  const bVisitsData = b.scData?.visits[scDataType as keyof KeywordSCDataChild] || 0;
                  const aVisitsData = a.scData?.visits[scDataType as keyof KeywordSCDataChild] || 0;
                  return bVisitsData > aVisitsData ? 1 : -1;
               });
            }
            break;
      default:
            return theKeywords;
   }

   // Stick Favorites item to top
   sortedItems = sortedItems.sort((a: KeywordType, b: KeywordType) => (b.sticky > a.sticky ? 1 : -1));

   return sortedItems;
};

/**
 * Filters the Keywords by Device when the Device buttons are switched
 * @param {KeywordType[]} sortedKeywords - The Sorted Keywords.
 * @param {string} device - Device name (desktop or mobile).
 * @returns {{desktop: KeywordType[], mobile: KeywordType[] } }
 */
export const keywordsByDevice = (sortedKeywords: KeywordType[], device: string): {[key: string]: KeywordType[] } => {
   const deviceKeywords: {[key:string] : KeywordType[]} = { desktop: [], mobile: [] };
   sortedKeywords.forEach((keyword) => {
      if (keyword.device === device) { deviceKeywords[device].push(keyword); }
   });
   return deviceKeywords;
};

/**
 * Filters the keywords by country, search string or tags.
 * @param {KeywordType[]} keywords - The keywords.
 * @param {KeywordFilters} filterParams - The user Selected filter object.
 * @returns {KeywordType[]}
 */
export const filterKeywords = (keywords: KeywordType[], filterParams: KeywordFilters):KeywordType[] => {
   const filteredItems:KeywordType[] = [];
   keywords.forEach((keywrd) => {
       const countryMatch = filterParams.countries.length === 0 ? true : filterParams.countries && filterParams.countries.includes(keywrd.country);
       const searchMatch = !filterParams.search ? true : filterParams.search
       && keywrd.keyword.toLowerCase().includes(filterParams.search.toLowerCase());
       const tagsMatch = filterParams.tags.length === 0 ? true : filterParams.tags && keywrd.tags.find((x) => filterParams.tags.includes(x));

       // PoloRank: trend (vs. `compare` days ago) and top-N filters
       const compareDays = filterParams.compare || 7;
       const changeKey = `d${compareDays}` as 'd7' | 'd30' | 'd60' | 'd90';
       const entry = keywrd.stats?.changes?.[changeKey];
       // "entered"/"left" have no number but they are unambiguously up/down, so they must pass the trend filter too
       const goingUp = entry?.state === 'entered' || (typeof entry?.change === 'number' && entry.change > 0);
       const goingDown = entry?.state === 'left' || (typeof entry?.change === 'number' && entry.change < 0);
       const wantedTrend = filterParams.trend === 'up' ? goingUp : goingDown;
       const trendMatch = !filterParams.trend || filterParams.trend === 'all' ? true : wantedTrend;
       const topMatch = !filterParams.top || filterParams.top === 'all'
          ? true
          : (keywrd.position > 0 && keywrd.position <= parseInt(filterParams.top, 10));

       if (countryMatch && searchMatch && tagsMatch && trendMatch && topMatch) {
          filteredItems.push(keywrd);
       }
   });

   return filteredItems;
};
