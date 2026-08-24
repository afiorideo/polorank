/* eslint-disable object-property-newline */
/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');

/**
 * PoloRank theme — Emignia palette, light + dark.
 *
 * The whole SerpBear UI is written with Tailwind palette classes (bg-white, text-gray-500, bg-blue-700, bg-indigo-50…).
 * Instead of touching every component, those palette entries are remapped to CSS variables (see styles/globals.css)
 * that change with the `.dark` class on <html>. Semantic tokens (surface, ink, brand…) are also available for new code.
 */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

module.exports = {
   darkMode: 'class',
   content: [
      './pages/**/*.{js,ts,jsx,tsx}',
      './components/**/*.{js,ts,jsx,tsx}',
   ],
   safelist: [
      'max-h-48',
      'w-[150px]',
      'w-[240px]',
      'min-w-[270px]',
      'min-w-[180px]',
      'max-w-[180px]',
    ],
   theme: {
      extend: {
         fontFamily: {
            sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
            display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
         },
         colors: {
            // ---- semantic tokens (new code) ----
            bg: v('bg'),
            surface: v('surface'),
            'surface-2': v('surface-2'),
            line: v('line'),
            'line-2': v('line-2'),
            ink: v('ink'),
            'ink-2': v('ink-2'),
            muted: v('muted'),
            faint: v('faint'),
            brand: { DEFAULT: v('brand'), hover: v('brand-hover'), soft: v('brand-soft'), 'soft-2': v('brand-soft-2'), text: v('brand-text') },
            cyan: { DEFAULT: '#00E5FF' },
            // ---- palette remap (existing SerpBear classes become theme-aware) ----
            gray: {
               ...colors.gray,
               50: v('surface-2'), 100: v('line-2'), 200: v('line'), 300: v('faint'), 400: v('faint'), 500: v('muted'),
               600: v('ink-2'), 700: v('ink'), 800: v('ink'), 900: v('ink'),
            },
            slate: {
               ...colors.slate,
               50: v('surface-2'), 100: v('line-2'), 200: v('line'), 300: v('faint'), 400: v('faint'), 500: v('muted'),
               600: v('ink-2'), 700: v('ink'), 800: v('ink'),
            },
            zinc: { ...colors.zinc, 500: v('muted'), 800: v('ink') },
            blue: {
               ...colors.blue,
               50: v('brand-soft'), 100: v('brand-soft-2'), 200: v('brand-soft-2'), 600: v('brand-text'), 700: v('brand'), 800: v('brand-hover'),
            },
            indigo: {
               ...colors.indigo,
               50: v('brand-soft'), 100: v('brand-soft-2'), 200: v('brand-soft-2'), 300: v('brand-soft-2'), 500: v('brand-text'),
               600: v('brand-text'), 700: v('brand-text'),
            },
            emerald: { ...colors.emerald, 100: v('ok-soft'), 500: v('ok'), 600: v('ok'), 700: v('ok') },
            green: { ...colors.green, 100: v('ok-soft'), 500: v('ok'), 600: v('ok') },
            amber: { ...colors.amber, 50: v('warn-soft'), 100: v('warn-soft'), 200: v('warn-line'), 300: v('warn-line'), 700: v('warn') },
            yellow: { ...colors.yellow, 500: v('warn'), 600: v('warn') },
            rose: { ...colors.rose, 100: v('bad-soft'), 500: v('bad'), 700: v('bad') },
            red: { ...colors.red, 50: v('bad-soft'), 100: v('bad-soft'), 200: v('bad-line'), 400: v('bad'), 500: v('bad'), 700: v('bad') },
         },
         boxShadow: {
            card: '0 0 20px rgb(var(--c-shadow) / 0.06)',
         },
      },
   },
   plugins: [],
 };
