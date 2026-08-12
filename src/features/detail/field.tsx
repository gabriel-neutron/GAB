/**
 * One value, one control, one size.
 *
 * Built from `docs/detail-surface.md` §4.2, and from the findings §3.4 and §3.7. The rule of
 * §5.3 holds every control disabled until #42 closes.
 *
 * The control comes from `ClaimValue`, which is a closed union on `control`. The guess that
 * chose that control lives in `./claims`, and this file adds no second guess: it draws what it
 * is given.
 */

import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/ui/input';

import type { ClaimValue } from './claims';

export interface FieldProps {
  /** The accessible name of the control. */
  readonly label: string;
  /** The value, with the control it asks for. */
  readonly value: ClaimValue;
}

/**
 * The correction of §3.4, at the call site, because the kit is closed and is not edited.
 *
 * **The defect this list exists to not repeat:** a shadcn `Input` under `disabled` loses half
 * its opacity, and the value — the most important text on the screen — was drawn at about
 * 3.3:1. A read-only surface says "not editable" with a flat fill, and keeps the data at full
 * contrast. **Do not restore `opacity-50`.**
 *
 * The kit writes `text-base md:text-sm` and a dark fill of its own, so both are beaten here.
 * One class of the pair alone leaves the value at another size, or on another ground, and §4.2
 * asks for one size.
 *
 * **The second defect this list exists to not repeat:** the kit also writes
 * `disabled:pointer-events-none`. It killed every `title` on the surface, so the full value of
 * a truncated cell never appeared, and the analyst could not select or copy a value either.
 * `title` is the whole mitigation rule 16 gives a truncated value. `disabled:pointer-events-auto`
 * gives it back and `disabled` stays, so §5.3 still holds. **Do not remove it.**
 *
 * Rule 17 and the skill: a state change lasts under 120ms. The kit writes `transition-colors`
 * with no duration, and the Tailwind default is 150ms, so the duration is stated here.
 */
const BOX =
  'h-6 w-full rounded-none border-transparent bg-muted px-1.5 py-0 text-xs duration-100 md:text-xs dark:bg-muted disabled:opacity-100 disabled:bg-muted disabled:text-foreground disabled:cursor-default disabled:pointer-events-auto dark:disabled:bg-muted';

/**
 * Rules 12 and 13: every identifier, count, date and code is monospace, and figures are tabular.
 * A number and a date take it; a text does not.
 *
 * **The figures are not right-aligned.** Rule 13 aligns a *column* of figures, and there is no
 * column here: §4.1 puts the name of the claim to the left of each cell and lets the cells flow
 * about 2.6 to a line, so a right edge would land at a different place on every cell and the
 * value would sit far from the name it belongs to. `tabular-nums` still holds the digits on one
 * width.
 */
const FIGURES = 'font-mono tabular-nums';

/**
 * §3.7: a number field reserves room for a spinner it never shows, and that room truncated a
 * five-digit tonnage to three digits. **Do not restore the spinner.**
 *
 * The two `-webkit-` rules reach Chromium and WebKit. **Firefox reads neither**, so the standard
 * property follows and the correction is not Chromium-only. The suite runs in Chromium alone, so
 * **no story can see the Firefox case**: a person must look at it there.
 */
const NO_SPINNER =
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

/**
 * A yes-or-no is a real checkbox, so that the state reads without the word beside it, and so
 * that the role, the name and `aria-checked` stay correct.
 *
 * **The defect this list exists to not repeat:** the control was a bare checkbox, and the
 * browser paints a disabled checkbox itself, in its own grey, at about 2 to 3:1. §3.4 was
 * therefore restored on the one type of the four that got no correction, and
 * `disabled:opacity-100` cannot reach it, because that greying is not opacity. `appearance-none`
 * takes the paint away from the browser and the box is drawn from declared tokens: an `input`
 * edge at 3.4:1 light and 3.2:1 dark, a `muted` ground, and a `foreground` fill for the ticked
 * state at 16:1. **Do not remove `appearance-none`.**
 *
 * **The second defect this pair exists to not repeat:** the tick stood alone at 14 px on a line
 * where every other control is 24 px. Rule 1 of `src/index.css` states one control height,
 * `--control-height: 24px`, and §4.2 asks for one size. A small glyph reads better than a 24 px
 * square, so the glyph keeps 14 px and the **box** takes the row height. **Do not take the box
 * away.**
 */
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
        // **This is the one point that guesses the control, and it names the two open
        // questions.** §4.2 names a number control and a date control, so the control itself is
        // a guess the surface document permits. What it does not settle is §9: the decimal
        // separator and the date format stay open. §3.7 records why it matters — a native field
        // prints in the locale of the machine, so this box shows `32,26` on one machine and
        // `32.26` on another, and a date box shows the order the machine chooses. §3.7 also
        // says that a published surface which must print a decimal point cannot use a number
        // input at all. **#46 owns the type of an attribute and #12 owns what the surface
        // states about itself; neither is answered here.**
        <Input
          type="number"
          // §5.3: the surface writes nothing, so the value is a default and never a bound
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
      // §4.2: a list is joined into the one box. `./claims` joined it.
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
