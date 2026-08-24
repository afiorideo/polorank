import React, { useEffect, useState } from 'react';
import Icon from './Icon';

export const THEME_KEY = 'polorank-theme';
type Theme = 'light' | 'dark';

const systemTheme = (): Theme => (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

const THEME_EVENT = 'polorank-theme-change';

export const applyTheme = (theme: Theme) => {
   if (typeof document === 'undefined') { return; }
   document.documentElement.classList.toggle('dark', theme === 'dark');
   document.documentElement.style.colorScheme = theme;
   // keep every toggle on the page (desktop + mobile) in sync
   window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
};

/** PoloRank: light/dark switch. Preference lives in localStorage; without one, the system setting wins. */
const ThemeToggle = ({ className = '' }: { className?: string }) => {
   const [theme, setTheme] = useState<Theme>('light');

   useEffect(() => {
      let stored: string | null = null;
      try { stored = window.localStorage.getItem(THEME_KEY); } catch (e) { stored = null; }
      const initial: Theme = stored === 'dark' || stored === 'light' ? stored : systemTheme();
      setTheme(initial);
      document.documentElement.classList.toggle('dark', initial === 'dark');
      const onChange = (e: Event) => { const next = (e as CustomEvent<Theme>).detail; if (next === 'dark' || next === 'light') { setTheme(next); } };
      window.addEventListener(THEME_EVENT, onChange);
      return () => window.removeEventListener(THEME_EVENT, onChange);
   }, []);

   const toggle = () => {
      const next: Theme = theme === 'dark' ? 'light' : 'dark';
      setTheme(next);
      applyTheme(next);
      try { window.localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage unavailable: theme still applies for this page */ }
   };

   return (
      <button
      type='button'
      data-testid='theme_toggle'
      className={`theme_toggle inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 text-gray-500
      hover:text-blue-700 hover:border-blue-200 transition-colors ${className}`}
      onClick={toggle}
      title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}>
         {theme === 'dark' ? <Icon type='sun' size={15} /> : <Icon type='moon' size={15} />}
      </button>
   );
};

export default ThemeToggle;
