/**
 * The legend of the graph — what the paint means, and how much is out of consideration.
 *
 * Built from `docs/graph-surface.md` §4.5, §3.3, §5.5 and §8 step 6.
 *
 * **The definitions fold away. The counts never do.** §4.5: an encoding is learned one time and
 * is noise after that, so it is on demand. A count is live, and an analyst who cannot see how
 * much is dimmed cannot trust what is lit. So the counts stay in the tree for each value of
 * `open`, and the definitions leave the tree when `open` is false. A definition that is hidden
 * with a class stays reachable to a reader and to the keyboard, and that is a lie about what the
 * panel shows.
 *
 * **It derives nothing.** `model.ts` computes `legendDefinitions` and `legendCounts`, and this
 * file draws them. The two `.map` calls turn those two arrays into elements, and there is no
 * other read of them.
 *
 * **It holds no state.** `open` is a prop, because the open state of a panel is the workspace
 * (ADR 0004 §7) and the `controller` of §4.3 owns that key. A copy here would be a second store
 * of one value, which is the fault the ADR names. The legend is a **sibling** of the canvas
 * (`CANVAS.md`), so React state would be permitted in it; the workspace rule is what refuses it.
 *
 * **The panel draws the rows it is given, and it filters none of them.** `model.ts` decides which
 * count is worth a line: a count of zero is dropped there, and a count of zero that is evidence
 * is kept there. A filter here would put that decision in two files.
 *
 * **The lit and dimmed line is drawn for each value of `open`.** It is the sentence §4.5 exists
 * for — how much of the picture is out of consideration — and the accepted prototype drew it
 * under the definitions on every frame.
 *
 * **The marker counts are here because nobody drew them, and §8 step 7 asks for one of them.**
 * The `controller` of §4.3 caps the markers at the ceiling of §3.3 and publishes the remainder,
 * and no file outside it read either figure. The counts of `model.ts` beside them are a different
 * number: they count a proposal that names **no** element, and the remainder counts an element
 * that carries a proposal and gets no marker.
 *
 * **The four read values arrive as one shape, `LegendReading`.** They always travel together, and
 * as four props this seam would pass the five the skill allows.
 */

import { ChevronDown, ChevronRight } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

import type { LegendCount, LegendDefinition, LegendToken } from './model';

/** The region the fold control opens. One surface draws one legend, so one constant is enough. */
const DEFINITIONS_ID = 'graph-legend-definitions';

/**
 * The swatch of each token, written out whole.
 *
 * **Tailwind reads the source for a class it can see, and it sees no class built from a
 * variable.** A template string of `bg-${token}` emits no rule at all, in silence, and the swatch
 * then keeps the inherited colour and looks correct. So the four classes are written here in
 * full, and `LegendToken` is a closed set so that no line can arrive without one.
 */
const SWATCH: Readonly<Record<LegendToken, string>> = {
  'entity-1': 'bg-entity-1',
  dissent: 'bg-dissent',
  'muted-foreground': 'bg-muted-foreground',
  label: 'bg-label',
};

/**
 * How many elements the filter keeps lit, and how many it dims. §5.2: a filter dims and never
 * hides, so the two together are the whole picture. The `controller` of §4.3 publishes both.
 */
export interface FilterReach {
  readonly lit: number;
  readonly dimmed: number;
}

/**
 * How many elements carry a marker of UC5, and how many carry a pending proposal and get none.
 *
 * §3.3: a marker drawn as an element of the page has a ceiling, so the `controller` of §4.3 caps
 * it and publishes the remainder. **§8 step 7 asks for that remainder on the screen**, and this
 * panel is where it goes: a surface that drops evidence in silence is worse than one that says
 * how much it dropped. It is a **view** value and not a model value, so it travels the path `lit`
 * and `dimmed` take.
 */
export interface MarkerReach {
  readonly drawn: number;
  readonly overCap: number;
}

/**
 * Everything the legend states. **The four read values travel together**, and they arrive as one
 * shape: three of them were three props of one clump, and the marker counts would have made a
 * fifth prop of a component the skill keeps under five.
 */
export interface LegendReading {
  /** What the paint means. The encoding, which folds away. */
  readonly definitions: readonly LegendDefinition[];
  /** What the surface drops, and cannot draw. Live, and always drawn. */
  readonly counts: readonly LegendCount[];
  /** How much of the picture is out of consideration. Drawn for each value of `open`. */
  readonly reach: FilterReach;
  /** How many markers are drawn, and how many pending elements carry none. */
  readonly markers: MarkerReach;
}

export interface LegendProps {
  readonly reading: LegendReading;
  /** Whether the definitions are shown. The workspace holds it — ADR 0004 §7. */
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function Legend({ reading, open, onOpenChange }: LegendProps) {
  const { definitions, counts, reach, markers } = reading;
  return (
    // §5.5: a panel that floats over the canvas takes no pointer event on its own padding, so a
    // drag that starts there still moves the graph below it. Two elements take the pointer back,
    // and no more: the fold control, and the label of a count, which needs a pointer for its
    // `title`. Each other element keeps no pointer, so most of the panel passes a drag through.
    <div
      className={cn(
        'pointer-events-none flex w-64 flex-col gap-2 rounded-none border bg-popover p-2',
        'text-xs text-popover-foreground',
      )}
    >
      {/* The border is transparent and one pixel wide at rest. Without a border width the
          `focus-visible:border-ring` half of the kit recipe paints nothing, and only the ring
          shows.

          The control names the region it opens **only while that region exists**. The list of
          definitions leaves the tree when the legend is folded, so a folded legend that named
          `DEFINITIONS_ID` sent a reader to an element that is not there. `./rail` states the same
          rule on the chevron of a type row. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? DEFINITIONS_ID : undefined}
        onClick={() => {
          onOpenChange(!open);
        }}
        className={cn(
          'pointer-events-auto flex h-6 w-full items-center gap-1 rounded-none text-left',
          'border border-transparent',
          'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        )}
      >
        {open ? (
          <ChevronDown size={14} aria-hidden="true" />
        ) : (
          <ChevronRight size={14} aria-hidden="true" />
        )}
        {open ? 'Hide what the paint means' : 'Show what the paint means'}
      </button>

      {open ? (
        <ul id={DEFINITIONS_ID} className={cn('flex flex-col gap-2')}>
          {definitions.map((definition) => (
            // A definition is a label of one row, so it takes the row rule: `h-6`, `truncate
            // min-w-0`, and the full text under `title`. The labels are short, so nothing
            // truncates at this width in practice.
            <li key={definition.meaning} className={cn('flex h-6 items-center gap-2')}>
              {/* **The square takes a token, and never a literal.** `CANVAS.md` licenses the hex
                  copy of `model.ts` because a CSS custom property never reaches the Sigma parser,
                  and a square of the page is not that parser: a hex value here would be a second
                  copy that can drift from the canvas with nobody to see it. The square is
                  decorative and `aria-hidden`, and the text beside it names the thing in words,
                  so a reader who cannot use the hue still reads the meaning. A line that states a
                  rule and not a hue carries no square, and the model says which. */}
              {definition.token === null ? null : (
                <span
                  aria-hidden="true"
                  className={cn('size-2 shrink-0 rounded-none', SWATCH[definition.token])}
                />
              )}
              <span
                className={cn('pointer-events-auto min-w-0 flex-1 truncate text-label')}
                title={definition.meaning}
              >
                {definition.meaning}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* §4.5, and the accepted prototype: one line, on every frame, whatever `open` is. A
          filter dims and never hides (§5.2), so the two figures together are the whole picture,
          and an analyst who cannot see how much is dimmed cannot trust what is lit. The figures
          are drawn as they arrive: a group separator is a derivation, and this file makes none. */}
      <p className={cn('flex h-6 items-center gap-1 border-t pt-1 text-label')}>
        <span className={cn('font-mono tabular-nums text-popover-foreground')}>{reach.lit}</span>
        <span>lit</span>
        <span className={cn('font-mono tabular-nums text-popover-foreground')}>{reach.dimmed}</span>
        <span>dimmed</span>
      </p>

      {/* §8 step 7: **the count that cannot be drawn is stated on screen**, and in words. §3.3: a
          marker drawn as an element of the page has a ceiling, so the controller caps the markers
          and publishes the remainder. The drawn figure is always here, because a remainder with
          no total beside it states nothing; the second line appears where the cap bit, because a
          panel over the canvas draws no row for a loss that did not happen. */}
      <p className={cn('flex h-6 items-center gap-1 text-label')}>
        <span className={cn('font-mono tabular-nums text-popover-foreground')}>
          {markers.drawn}
        </span>
        <span className={cn('min-w-0 flex-1 truncate')}>markers drawn</span>
      </p>
      {markers.overCap === 0 ? null : (
        <p className={cn('flex h-6 items-center gap-1 text-label')}>
          <span className={cn('font-mono tabular-nums text-popover-foreground')}>
            {markers.overCap}
          </span>
          <span
            className={cn('pointer-events-auto min-w-0 flex-1 truncate')}
            title="Pending elements that carry no marker"
          >
            pending elements carry no marker
          </span>
        </p>
      )}

      <ul className={cn('flex flex-col')}>
        {counts.map((count) => (
          <li key={count.label} className={cn('flex h-6 items-center gap-2')}>
            {/* The full value of a label goes under `title`, which is the rule of the skill. The
                price is a label that reads two times for a reader where the text is short and
                does not truncate. The alternative is a measurement of the width, which this
                component must not make. */}
            <span
              className={cn('pointer-events-auto min-w-0 flex-1 truncate text-label')}
              title={count.label}
            >
              {count.label}
            </span>
            <span className={cn('shrink-0 text-right font-mono tabular-nums')}>{count.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
