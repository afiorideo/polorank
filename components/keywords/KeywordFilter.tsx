import React, { useState, useMemo } from 'react';
import Icon from '../common/Icon';
import SelectField, { SelectionOption } from '../common/SelectField';
import countries from '../../utils/countries';

type KeywordFilterProps = {
   device: string,
   allTags: string[],
   setDevice: Function,
   filterParams: KeywordFilters,
   filterKeywords: Function,
   keywords: KeywordType[] | SearchAnalyticsItem[],
   updateSort: Function,
   sortBy: string,
   integratedConsole?: boolean,
   isConsole?: boolean,
   SCcountries?: string[];
   updateColumns?: Function,
   tableColumns?: string[]
}

export const COMPARE_OPTIONS: { value: 7 | 30 | 60 | 90, label: string }[] = [
   { value: 7, label: '7 días' },
   { value: 30, label: '30 días' },
   { value: 60, label: '60 días' },
   { value: 90, label: '90 días' },
];

const KeywordFilters = (props: KeywordFilterProps) => {
   const {
      device,
      setDevice,
      filterKeywords,
      allTags = [],
      keywords = [],
      updateSort,
      sortBy,
      filterParams,
      isConsole = false,
      integratedConsole = false,
      updateColumns,
      SCcountries = [],
      tableColumns = [],
    } = props;
   const [sortOptions, showSortOptions] = useState(false);
   const [filterOptions, showFilterOptions] = useState(false);
   const [columnOptions, showColumnOptions] = useState(false);

   const keywordCounts = useMemo(() => {
      const counts = { desktop: 0, mobile: 0 };
      if (keywords && keywords.length > 0) {
         keywords.forEach((k) => {
            if (k.device === 'desktop') {
               counts.desktop += 1;
            } else {
               counts.mobile += 1;
            }
         });
      }
      return counts;
   }, [keywords]);

   const filterCountry = (cntrs:string[]) => filterKeywords({ ...filterParams, countries: cntrs });
   const filterTags = (tags:string[]) => filterKeywords({ ...filterParams, tags });
   const setTrend = (trend: 'all' | 'up' | 'down') => filterKeywords({ ...filterParams, trend });
   const setTop = (top: 'all' | '10' | '20') => filterKeywords({ ...filterParams, top });
   const setCompare = (compare: 7 | 30 | 60 | 90) => filterKeywords({ ...filterParams, compare });

   const searchKeywords = (event:React.FormEvent<HTMLInputElement>) => {
      const filtered = filterKeywords({ ...filterParams, search: event.currentTarget.value });
      return filtered;
   };

   const countryOptions = useMemo(() => {
      const optionObject:{label:string, value:string}[] = [];

      if (!isConsole) {
         const allCountries = Array.from(keywords as KeywordType[])
         .map((keyword) => keyword.country)
         .reduce<string[]>((acc, country) => [...acc, country], [])
         .filter((t) => t && t.trim() !== '');
         [...new Set(allCountries)].forEach((c) => {
            if (countries[c]) { optionObject.push({ label: countries[c][0], value: c }); }
         });
      } else {
         Object.keys(countries).forEach((countryISO:string) => {
            if ((SCcountries.includes(countryISO))) {
               optionObject.push({ label: countries[countryISO][0], value: countryISO });
            }
         });
      }

      return optionObject;
   }, [SCcountries, isConsole, keywords]);

   const sortOptionChoices: SelectionOption[] = [
      { value: 'pos_asc', label: 'Mejor posición primero' },
      { value: 'pos_desc', label: 'Peor posición primero' },
      { value: 'change_desc', label: 'Las que más subieron' },
      { value: 'change_asc', label: 'Las que más bajaron' },
      { value: 'best_asc', label: 'Mejor histórica' },
      { value: 'date_asc', label: 'Más recientes (por defecto)' },
      { value: 'date_desc', label: 'Más antiguas' },
      { value: 'alpha_asc', label: 'Alfabético (A-Z)' },
      { value: 'alpha_desc', label: 'Alfabético (Z-A)' },
      { value: 'vol_asc', label: 'Menor volumen' },
      { value: 'vol_desc', label: 'Mayor volumen' },
   ];

   const columnOptionChoices: {label: string, value: string, locked: boolean}[] = [
      { value: 'Keyword', label: 'Keyword', locked: true },
      { value: 'Position', label: 'Posición', locked: true },
      { value: 'URL', label: 'URL', locked: true },
      { value: 'Evol', label: 'Evolución (30 días)', locked: false },
      { value: 'Volume', label: 'Volumen', locked: false },
      { value: 'Changes', label: '30d · 60d · 90d', locked: false },
      { value: 'Snippets', label: 'Snippets', locked: false },
      { value: 'Best', label: 'Mejor', locked: false },
      { value: 'Search Console', label: 'Search Console', locked: false },
   ];
   if (integratedConsole) {
      sortOptionChoices.push({ value: 'imp_desc', label: `Más impresiones${isConsole ? ' (por defecto)' : ''}` });
      sortOptionChoices.push({ value: 'imp_asc', label: 'Menos impresiones' });
      sortOptionChoices.push({ value: 'visits_desc', label: 'Más clics' });
      sortOptionChoices.push({ value: 'visits_asc', label: 'Menos clics' });
   }
   if (isConsole) {
      sortOptionChoices.splice(2, 5);
      sortOptionChoices.push({ value: 'ctr_asc', label: 'Mayor CTR' });
      sortOptionChoices.push({ value: 'ctr_desc', label: 'Menor CTR' });
   }
   const sortItemStyle = (sortType:string) => {
      return `cursor-pointer py-2 px-3 hover:bg-[#FCFCFF] ${sortBy === sortType ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-50' : ''}`;
   };
   const deviceTabStyle = 'select-none cursor-pointer px-3 py-2 rounded-3xl mr-2';
   const deviceTabCountStyle = 'px-2 py-0 rounded-3xl bg-[#DEE1FC] text-[0.7rem] font-bold ml-1';
   const mobileFilterOptionsStyle = 'visible mt-8 border absolute min-w-[0] rounded-lg max-h-96 bg-white z-50 w-52 right-2 p-4';
   const segment = 'inline-flex rounded-full border border-gray-200 bg-white overflow-hidden text-xs';
   const segItem = (on: boolean, tone = '') => {
      const off = `text-gray-500 hover:bg-gray-50 ${tone}`;
      return `px-3 py-1.5 cursor-pointer select-none ${on ? 'bg-blue-700 text-white' : off}`;
   };

   const trend = filterParams.trend || 'all';
   const top = filterParams.top || 'all';
   const compare = filterParams.compare || 30;

   return (
      <div className='domKeywords_filters py-4 px-6 text-sm text-gray-500 font-semibold border-b-[1px] lg:border-0'>
         <div className='flex justify-between'>
            <div>
               <ul className='flex text-xs'>
                  <li
                   data-testid="desktop_tab"
                  className={`${deviceTabStyle} ${device === 'desktop' ? ' bg-[#F8F9FF] text-gray-700' : ''}`}
                  onClick={() => setDevice('desktop')}>
                        <Icon type='desktop' classes='top-[3px]' size={15} />
                        <i className='hidden not-italic lg:inline-block ml-1'>Desktop</i>
                        <span className={`${deviceTabCountStyle}`}>{keywordCounts.desktop}</span>
                  </li>
                  <li
                  data-testid="mobile_tab"
                  className={`${deviceTabStyle} ${device === 'mobile' ? ' bg-[#F8F9FF] text-gray-700' : ''}`}
                  onClick={() => setDevice('mobile')}>
                        <Icon type='mobile' />
                        <i className='hidden not-italic lg:inline-block ml-1'>Mobile</i>
                        <span className={`${deviceTabCountStyle}`}>{keywordCounts.mobile}</span>
                  </li>
               </ul>
            </div>
            <div className='flex gap-5'>
               <div className=' lg:hidden'>
                  <button
                  data-testid="filter_button"
                  className={`px-2 py-1 rounded ${filterOptions ? ' bg-indigo-100 text-blue-700' : ''}`}
                  title='Filtrar'
                  onClick={() => showFilterOptions(!filterOptions)}>
                     <Icon type="filter" size={18} />
                  </button>
               </div>
               <div className={`lg:flex gap-5 lg:visible ${filterOptions ? mobileFilterOptionsStyle : 'hidden'}`}>
                  <div className={'country_filter mb-2 lg:mb-0'}>
                     <SelectField
                        selected={filterParams.countries}
                        options={countryOptions}
                        defaultLabel='Todos los países'
                        updateField={(updated:string[]) => filterCountry(updated)}
                        flags={true}
                     />
                  </div>
                  {!isConsole && (
                     <div className={'tags_filter mb-2 lg:mb-0'}>
                        <SelectField
                           selected={filterParams.tags}
                           options={allTags.map((tag:string) => ({ label: tag, value: tag }))}
                           defaultLabel='Todas las etiquetas'
                           updateField={(updated:string[]) => filterTags(updated)}
                           emptyMsg="Este dominio no tiene etiquetas"
                        />
                     </div>
                  )}
                  <div className={'mb-2 lg:mb-0'}>
                     <input
                        data-testid="filter_input"
                        className={'border w-44 lg:w-36 focus:w-44 transition-all rounded-3xl p-1.5 px-4 outline-none ring-0 focus:border-indigo-200'}
                        type="text"
                        placeholder='Buscar keyword…'
                        onChange={searchKeywords}
                        value={filterParams.search}
                     />
                  </div>
               </div>
               <div className='relative'>
                  <button
                  data-testid="sort_button"
                  className={`px-2 py-1 rounded ${sortOptions ? ' bg-indigo-100 text-blue-700' : ''}`}
                  title='Ordenar'
                  onClick={() => showSortOptions(!sortOptions)}>
                     <Icon type="sort" size={18} />
                  </button>
                  {sortOptions && (
                     <ul
                     data-testid="sort_options"
                     className='sort_options mt-2 border absolute w-52 min-w-[0] right-0 rounded-lg
                     max-h-96 bg-white z-[9999] overflow-y-auto styled-scrollbar'>
                        {sortOptionChoices.map((sortOption) => {
                           return <li
                                    key={sortOption.value}
                                    className={sortItemStyle(sortOption.value)}
                                    onClick={() => { updateSort(sortOption.value); showSortOptions(false); }}>
                                       {sortOption.label}
                                    </li>;
                        })}
                     </ul>
                  )}
               </div>
               {!isConsole && (
                  <div className='relative'>
                  <button
                  data-testid="columns_button"
                  className={`px-2 py-1 rounded ${columnOptions ? ' bg-indigo-100 text-blue-700' : ''}`}
                  title='Mostrar / ocultar columnas'
                  onClick={() => showColumnOptions(!columnOptions)}
                  >
                     <Icon type='eye-closed' size={18} />
                  </button>
                  {columnOptions && (
                     <ul
                     data-testid="sort_options"
                     className='sort_options mt-2 border absolute w-52 min-w-[0] right-0 rounded-lg
                     max-h-96 bg-white z-[9999] overflow-y-auto styled-scrollbar border-gray-200 '>
                        {columnOptionChoices.map(({ value, label, locked }) => {
                           return <li
                                    key={value}
                                    className={sortItemStyle(value) + (locked ? 'bg-gray-50 cursor-not-allowed pointer-events-none' : '') }
                                    onClick={() => { if (updateColumns) { updateColumns(value); } showColumnOptions(false); }}
                                    >
                                       <span className={' inline-block px-[3px] border border-gray-200  rounded-[4px] w-5'}>
                                          <Icon
                                          title={locked ? 'No se puede ocultar' : ''}
                                          type={locked ? 'lock' : 'check'}
                                          color={!tableColumns.includes(value) && !locked ? 'transparent' : '#999' }
                                          size={12}
                                          />
                                        </span>
                                       {' '}{label}

                                    </li>;
                        })}
                     </ul>
                  )}
               </div>
               )}
            </div>
         </div>

         {!isConsole && (
            <div className='domKeywords_trend flex flex-wrap items-center gap-3 mt-3' data-testid='trend_filters'>
               <span className={segment} title={`Según el cambio de posición vs. hace ${compare} días`}>
                  <span data-testid='trend_all' className={segItem(trend === 'all')} onClick={() => setTrend('all')}>Todas</span>
                  <span data-testid='trend_up' className={segItem(trend === 'up', 'text-emerald-600')} onClick={() => setTrend('up')}>
                     Subiendo ↑
                  </span>
                  <span data-testid='trend_down' className={segItem(trend === 'down', 'text-rose-500')} onClick={() => setTrend('down')}>
                     Bajando ↓
                  </span>
               </span>
               <span className={segment} title='Por posición actual'>
                  <span data-testid='top_all' className={segItem(top === 'all')} onClick={() => setTop('all')}>Todas</span>
                  <span data-testid='top_10' className={segItem(top === '10')} onClick={() => setTop('10')}>Top 10</span>
                  <span data-testid='top_20' className={segItem(top === '20')} onClick={() => setTop('20')}>Top 20</span>
               </span>
               <span className='inline-flex items-center gap-1 text-xs'>
                  <span className='text-gray-400 font-normal'>Comparar con:</span>
                  <span className={segment}>
                     {COMPARE_OPTIONS.map((opt) => (
                        <span
                           key={opt.value}
                           data-testid={`compare_${opt.value}`}
                           className={segItem(compare === opt.value)}
                           onClick={() => setCompare(opt.value)}>
                           {opt.label}
                        </span>
                     ))}
                  </span>
               </span>
            </div>
         )}
      </div>
   );
};

export default KeywordFilters;
