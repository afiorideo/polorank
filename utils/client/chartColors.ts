/**
 * PoloRank — chart colours from the CSS tokens. Canvas (Chart.js) cannot resolve `var(--x)` in colour strings,
 * so the token is read from the document at render time and converted to an rgb()/rgba() string.
 */
const readToken = (name: string, fallback: string): string => {
   if (typeof window === 'undefined' || typeof document === 'undefined') { return fallback; }
   const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
   return raw || fallback;
};

/** rgb triplet of the chart accent (violet); light default #6C63FF */
export const chartRgb = (): string => readToken('--c-chart', '108 99 255');

export const chartColor = (alpha: number = 1): string => {
   const [r, g, b] = chartRgb().split(/\s+/);
   return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const mutedColor = (alpha: number = 1): string => {
   const [r, g, b] = readToken('--c-muted', '100 116 139').split(/\s+/);
   return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const lineColor = (alpha: number = 1): string => {
   const [r, g, b] = readToken('--c-line', '226 232 240').split(/\s+/);
   return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
