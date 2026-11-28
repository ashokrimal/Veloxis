import {useCallback, useEffect, useState} from 'react';

export type SystemTheme = 'light' | 'dark';
export type ThemePreference = 'system' | 'light' | 'dark';

const MEDIA_QUERY = '(prefers-color-scheme: dark)';
const THEME_STORAGE_KEY = 'veloxis_theme_pref_v1';

function getOsTheme(): SystemTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light';
}

function loadThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      return raw;
    }
    return 'system';
  } catch {
    return 'system';
  }
}

function applyThemeToDocument(theme: SystemTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = theme === 'dark';

  root.classList.toggle('dark', isDark);
  root.style.colorScheme = theme;

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', isDark ? '#060913' : '#F3F1EC');
  }
}

export function useSystemTheme(): {
  theme: SystemTheme;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
  toggleTheme: () => void;
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(loadThemePreference);
  const [osTheme, setOsTheme] = useState<SystemTheme>(getOsTheme);

  const resolvedTheme: SystemTheme = preference === 'system' ? osTheme : preference;

  useEffect(() => {
    applyThemeToDocument(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Ignore storage errors
    }
  }, [preference]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setOsTheme(event.matches ? 'dark' : 'light');
    };

    setOsTheme(mediaQuery.matches ? 'dark' : 'light');

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferenceState((prev) => {
      const effective = prev === 'system' ? getOsTheme() : prev;
      return effective === 'dark' ? 'light' : 'dark';
    });
  }, []);

  return {
    theme: resolvedTheme,
    isDark: resolvedTheme === 'dark',
    preference,
    setPreference,
    toggleTheme,
  };
}
