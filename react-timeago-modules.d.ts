// PoloRank: react-timeago ships these submodules without typings
declare module 'react-timeago/lib/formatters/buildFormatter' {
   import type { Formatter } from 'react-timeago';

   const buildFormatter: (strings: { [key: string]: string | ((value: number) => string) }) => Formatter;
   export default buildFormatter;
}
declare module 'react-timeago/lib/language-strings/es' {
   const strings: { [key: string]: string };
   export default strings;
}
