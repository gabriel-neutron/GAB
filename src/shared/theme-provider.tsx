import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
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

const isTheme = (value: unknown): value is Theme =>
  value === 'dark' || value === 'light' || value === 'system';

// The compiler holds this list closed: a key added to `ShellWorkspace` and forgotten here fails
// the type check, so the guard below cannot fall behind the interface it guards.
const DECLARED_KEYS: Readonly<Record<keyof ShellWorkspace, true>> = { theme: true };

// The guard is strict, as every other workspace guard is: a record that carries a key the code
// no longer declares falls back, and the cost here is one theme, one time. The record holds one
// field, so the write below states it whole and carries nothing forward.
const isShellWorkspace = (value: unknown): value is ShellWorkspace =>
  holdsOnlyDeclaredKeys(value, DECLARED_KEYS) && isTheme(value['theme']);

const DEFAULT_THEME: Theme = 'dark';

// The theme is a store and not a context. The render at the release has no storage and draws the
// default; the hydration draws the same and then the stored theme. Only the readers of the theme
// render again: a new context value would make React hydrate every part of the report at once.
const listeners = new Set<() => void>();

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// The choice of this page stays in memory too: a browser that refuses storage keeps it until it
// leaves.
let chosen: Theme | null = null;

const readTheme = (): Theme =>
  chosen ?? readWorkspace('shell', isShellWorkspace, { theme: DEFAULT_THEME }).theme;

const setTheme = (next: Theme): void => {
  chosen = next;
  writeWorkspace('shell', { theme: next } satisfies ShellWorkspace);
  for (const listener of listeners) listener();
};

export function useTheme(): ThemeProviderState {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
  return { theme, setTheme };
}

/** Applies the theme to the document. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();

  useEffect(() => {
    const root = window.document.documentElement;
    const query = window.matchMedia('(prefers-color-scheme: dark)');

    // `system` follows the operating system while the page is open, so the query needs a listener.
    // A class that is set already stays: a change of the root class restyles the whole page.
    const apply = (): void => {
      const dark = theme === 'system' ? query.matches : theme === 'dark';
      root.classList.toggle('dark', dark);
      root.classList.toggle('light', !dark);
    };

    apply();
    query.addEventListener('change', apply);

    return () => {
      query.removeEventListener('change', apply);
    };
  }, [theme]);

  return children;
}
