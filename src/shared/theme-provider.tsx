import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { readWorkspace, writeWorkspace } from '@/shared/storage';

/** The value read from `localStorage` is unknown, so a guard checks it before its first use. */

export type Theme = 'dark' | 'light' | 'system';

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

interface ShellWorkspace {
  theme: Theme;
}

export const isTheme = (value: unknown): value is Theme =>
  value === 'dark' || value === 'light' || value === 'system';

// The guard reads `theme` and rejects nothing else, so a record that holds a later value beside
// it passes and reaches the caller complete. Do not make this guard exact: `setTheme` copies the
// record it reads, and an exact guard would drop every field it does not name.
const isShellWorkspace = (value: unknown): value is ShellWorkspace =>
  typeof value === 'object' && value !== null && 'theme' in value && isTheme(value.theme);

// The default is `undefined`, and not a stub state, so that a component used outside the
// provider fails loudly instead of silently reading a theme nobody set.
const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: {
  children: ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setTheme] = useState<Theme>(
    () => readWorkspace('shell', isShellWorkspace, { theme: defaultTheme }).theme,
  );

  useEffect(() => {
    const root = window.document.documentElement;
    const query = window.matchMedia('(prefers-color-scheme: dark)');

    // `system` follows the operating system while the page is open, so the query needs a listener.
    const apply = (): void => {
      root.classList.remove('light', 'dark');

      if (theme === 'system') {
        root.classList.add(query.matches ? 'dark' : 'light');
        return;
      }

      root.classList.add(theme);
    };

    apply();
    query.addEventListener('change', apply);

    return () => {
      query.removeEventListener('change', apply);
    };
  }, [theme]);

  const value: ThemeProviderState = {
    theme,
    setTheme: (next: Theme) => {
      // The key holds the whole workspace of the shell. Read the record first, so that a value
      // another part of the shell wrote beside `theme` stays after a change of theme.
      const current = readWorkspace('shell', isShellWorkspace, { theme: next });
      writeWorkspace('shell', { ...current, theme: next });
      setTheme(next);
    },
  };

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

export function useTheme(): ThemeProviderState {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');

  return context;
}
