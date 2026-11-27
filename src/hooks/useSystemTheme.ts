import {useEffect, useState} from 'react';

export type SystemTheme = 'light' | 'dark';

const MEDIA_QUERY = '(prefers-color-scheme: dark)';

function getPreferredTheme(): SystemTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light';
}

function applyThemeToDocument(theme: SystemTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = theme === 'dark';

  root.classList.toggle('dark', isDark);
  root.style.colorScheme = theme;

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', isDark ? '#0B1120' : '#FFFFFF');
  }
}

export function useSystemTheme(): {theme: SystemTheme; isDark: boolean} {
  const [theme, setTheme] = useState<SystemTheme>(() => getPreferredTheme());

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      const nextTheme: SystemTheme = event.matches ? 'dark' : 'light';
      setTheme(nextTheme);
      applyThemeToDocument(nextTheme);
    };

    // Sync once on mount in case OS preference changed before effect ran
    const current: SystemTheme = mediaQuery.matches ? 'dark' : 'light';
    setTheme(current);
    applyThemeToDocument(current);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    // Legacy Safari fallback
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return {theme, isDark: theme === 'dark'};
}
