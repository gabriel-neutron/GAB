import { Monitor, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import type { Theme } from '@/shared/theme-provider';

export interface ModeToggleProps {
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
      size="icon-xs"
      // No `aria-pressed`. Three states are not a pressed state.
      aria-label={`Theme: ${WORD[theme]}. Change to ${WORD[next]}.`}
      onClick={() => {
        onThemeChange(next);
      }}
      // The kit writes `transition-all` with no duration, which runs above the 120 ms ceiling and
      // animates every property. The correction is made at the call site, because a vendored file
      // is closed.
      className={cn('transition-colors duration-100')}
    >
      {/* The kit sizes a glyph at 12 px for this control size. The visual language states 14 px,
          and a size class at the call site is what the kit's own rule stands aside for. */}
      <Glyph className="size-3.5" aria-hidden="true" />
    </Button>
  );
}
