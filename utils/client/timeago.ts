import buildFormatter from 'react-timeago/lib/formatters/buildFormatter';
import esStrings from 'react-timeago/lib/language-strings/es';

/** PoloRank: Spanish relative dates for react-timeago ("hace 2 horas"). */
const timeAgoFormatter = buildFormatter(esStrings);

export default timeAgoFormatter;
