import buildFormatter from 'react-timeago/lib/formatters/buildFormatter';
import esStrings from 'react-timeago/lib/language-strings/es';

/** PoloRank: Spanish relative dates for react-timeago ("hace 2 horas"). */
const timeAgoFormatter = buildFormatter(esStrings);

/**
 * PoloRank: compact form for the "Actualizado" column — "1h", "3d" instead of "hace 1 hora".
 * The exact date always travels in the cell's tooltip, so nothing is lost.
 * Units are kept unambiguous in Spanish: min ≠ mes, d ≠ día del mes.
 */
const COMPACT_UNITS: { [unit: string]: string } = {
   second: 's',
   minute: 'min',
   hour: 'h',
   day: 'd',
   week: 'sem',
   month: 'mes',
   year: 'a',
};

export const timeAgoCompact = (value: number, unit: string): string => {
   if (unit === 'second' && value < 45) { return 'ahora'; }
   return `${value}${COMPACT_UNITS[unit] || unit}`;
};

export default timeAgoFormatter;
