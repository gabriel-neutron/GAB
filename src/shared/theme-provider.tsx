import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { holdsOnlyDeclaredKeys, readWorkspace, writeWorkspace } from '@/shared/storage';

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

// The compiler holds this list closed: a key added to `ShellWorkspace` and forgotten here fails
// the type check, so the guard below cannot fall behind the interface it guards.
const DECLARED_KEYS: Readonly<Record<keyof ShellWorkspace, true>> = { theme: true };

// The guard is strict, as every other workspace guard is: a record that carries a key the code
// no longer declares falls back, and the cost here is one theme, one time. The record holds one
// field, so the write below states it whole and carries nothing forward.
const isShellWorkspace = (value: unknown): value is ShellWorkspace =>
  holdsOnlyDeclaredKeys(value, DECLARED_KEYS) && isTheme(value['theme']);

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
      writeWorkspace('shell', { theme: next } satisfies ShellWorkspace);
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
