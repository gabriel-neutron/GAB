import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/ui/input';

import type { ClaimValue } from './claims';

export interface FieldProps {
  readonly label: string;
  readonly value: ClaimValue;
}

// The shadcn kit sets `opacity-50`, `text-base md:text-sm`, a dark fill, and
// `disabled:pointer-events-none`, which killed every `title`. Each is beaten here. The kit gives
// `transition-colors` no duration, and the Tailwind default is 150ms, so 100ms is stated here.
const BOX =
  'h-6 w-full rounded-none border-transparent bg-muted px-1.5 py-0 text-xs duration-100 md:text-xs dark:bg-muted disabled:opacity-100 disabled:bg-muted disabled:text-foreground disabled:cursor-default disabled:pointer-events-auto dark:disabled:bg-muted';

// The figures are not right-aligned. Alignment is for a column of figures, and the cells flow
// about 2.6 to a line, so a right edge would land at a different place on each cell, far from the
// name it belongs to. `tabular-nums` still holds the digits on one width.
const FIGURES = 'font-mono tabular-nums';

// A number field reserves room for a spinner it never shows, and that room truncated a
// five-digit tonnage to three digits. The two `-webkit-` rules reach Chromium and WebKit, but
// Firefox reads neither, so the standard property follows.
const NO_SPINNER =
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

// The browser paints a disabled checkbox in its own grey at about 2 to 3:1, and that grey is not
// opacity, so `disabled:opacity-100` cannot reach it. `appearance-none` takes the paint away and
// the box uses declared tokens. The glyph keeps 14 px, and the box takes the 24 px row height.
const TICK_BOX = 'inline-flex h-6 shrink-0 items-center';
const TICK =
  'size-3.5 shrink-0 appearance-none rounded-none border border-input bg-muted checked:border-foreground checked:bg-foreground disabled:opacity-100 disabled:cursor-default disabled:pointer-events-auto';

export function Field({ label, value }: FieldProps) {
  switch (value.control) {
    case 'boolean':
      return (
        <span className={cn(TICK_BOX)}>
          <input
            type="checkbox"
            checked={value.checked}
            readOnly
            disabled
            aria-label={label}
            title={value.text}
            className={cn(TICK)}
          />
        </span>
      );
    case 'number':
      return (
        // A native number field prints in the locale of the machine, so this box shows `32,26`
        // on one machine and `32.26` on another. A surface that must print a decimal point
        // cannot use a number input.
        <Input
          type="number"
          // The surface writes nothing, so the value is a default and never a bound
          // value with no handler.
          defaultValue={value.text}
          disabled
          aria-label={label}
          title={value.text}
          className={cn(BOX, FIGURES, NO_SPINNER)}
        />
      );
    case 'date':
      return (
        <Input
          type="date"
          defaultValue={value.text}
          disabled
          aria-label={label}
          title={value.text}
          className={cn(BOX, FIGURES)}
        />
      );
    case 'text':
    case 'note':
    case 'list':
      // A list is joined into the one box. `./claims` joined it.
      return (
        <Input
          type="text"
          defaultValue={value.text}
          disabled
          aria-label={label}
          title={value.text}
          className={cn(BOX)}
        />
      );
  }
}
