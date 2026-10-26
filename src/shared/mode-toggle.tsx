import { Monitor, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import type { Theme } from '@/shared/theme-provider';

interface ModeToggleProps {
  readonly theme: Theme;
  readonly onThemeChange: (theme: Theme) => void;
}

const NEXT: Readonly<Record<Theme, Theme>> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const GLYPH: Readonly<Record<Theme, LucideIcon>> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const WORD: Readonly<Record<Theme, string>> = {
  light: 'light',
  dark: 'dark',
  system: 'system',
};

export function ModeToggle({ theme, onThemeChange }: ModeToggleProps) {
  const next = NEXT[theme];
  const Glyph = GLYPH[theme];

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      // No `aria-pressed`. Three states are not a pressed state.
      aria-label={`Theme: ${WORD[theme]}. Change to ${WORD[next]}.`}
      onClick={() => {
        onThemeChange(next);
      }}
    >
      <Glyph className="size-3.5" aria-hidden="true" />
    </Button>
  );
}
