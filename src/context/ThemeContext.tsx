import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'mlm:theme';
const SYSTEM_DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

type ThemeContextValue = {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (raw === 'dark' || raw === 'light') return raw;
  return null;
}

function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia(SYSTEM_DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [storedTheme, setStoredTheme] = useState<ThemeMode | null>(() =>
    readStoredTheme()
  );
  const [systemTheme, setSystemTheme] = useState<ThemeMode>(() =>
    getSystemTheme()
  );

  const theme = storedTheme ?? systemTheme;

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia(SYSTEM_DARK_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (storedTheme) {
      window.localStorage.setItem(THEME_STORAGE_KEY, storedTheme);
      return;
    }
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  }, [storedTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      if (event.newValue === 'dark' || event.newValue === 'light') {
        setStoredTheme(event.newValue);
        return;
      }
      setStoredTheme(null);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setStoredTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setStoredTheme((prevTheme) => {
      const current = prevTheme ?? getSystemTheme();
      return current === 'dark' ? 'light' : 'dark';
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme,
    }),
    [setTheme, theme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
