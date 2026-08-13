import { Monitor, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import type { Theme } from '@/shared/theme-provider';

/**
 * The theme control: one button that cycles the three themes.
 *
 * **The theme arrives as a prop, and this file reads no context and no `localStorage`.** A
 * component that reads the theme itself cannot be mounted with plain values, so it cannot be
 * storied, and that is the seam telling you where the read belongs. The route holds the read,
 * inside the provider, and it is the one caller.
 *
 * **It is a button and not a list.** The operator asked for a control that a click changes. The
 * cost is stated and it is accepted: the three themes are no longer offered at one time, so
 * `system` is two clicks from `light`. The accessible name carries the state at every step, so
 * the reader is never lost.
 *
 * **`system` stays a state of this control.** It is the default of the provider, so it is the
 * state a first-time reader is in, and a state that no control can name is a state a reader
 * cannot return to. That is why the control cycles three and never toggles two.
 *
 * **The glyph is swapped and the colour changes. Nothing morphs.** A shape that morphs from a sun
 * to a moon and reads as one takes longer than the 120 ms the visual language allows for a state
 * change. The duration is stated here, because the kit writes `transition-all` with no duration
 * and the framework default is above the ceiling.
 */
export interface ModeToggleProps {
  readonly theme: Theme;
  readonly onThemeChange: (theme: Theme) => void;
}

/**
 * The cycle. **The compiler holds it closed**: the map is keyed by every `Theme`, so a fourth
 * theme added to the provider fails the type check here and cannot fall out of the cycle in
 * silence.
 */
const NEXT: Readonly<Record<Theme, Theme>> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

/** The glyph of each state. Keyed by `Theme` for the same reason as the cycle above. */
const GLYPH: Readonly<Record<Theme, LucideIcon>> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/** The word of each state, as it reads inside a sentence. */
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
      // An icon-only control carries an accessible name. The name says the state in force and
      // what a click does, because a glyph alone says neither to a reader who cannot see it.
      //
      // It carries no `aria-pressed`. Three states are not a pressed state, and a control that
      // reports one of three as "pressed" reports a state that does not exist.
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
