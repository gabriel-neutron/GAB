/**
 * The claims of one entity, grouped and flowing.
 *
 * Built from `docs/detail-surface.md` §4.1, and from the findings §3.1 and §3.2. §5.1 puts the
 * mark of the source in every claim cell, and no control hides it.
 *
 * The rows arrive flat from `./dossier`: a heading is a row, so this file holds exactly one
 * `.map` and no derivation at all.
 */

import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

import type { RecordRow, SourceRef } from './dossier';
import { Field } from './field';

export interface EntityRecordProps {
  /** Already flat, already grouped, already in order. `./dossier` decides all three. */
  readonly rows: readonly RecordRow[];
  /** The mark of §5.1. The caller owns which source is active and what a click does. */
  readonly mark: (sources: readonly SourceRef[]) => ReactNode;
}

/**
 * §4.1, the four widths, as classes. A derivation holds no class string, so the name arrives
 * from `./claims` and this table turns it into a width.
 *
 * **One rule serves the page and the 24 rem sidebar.** Each cell is `grow min-w-0`, so a basis
 * wider than the pane makes one cell fill the line and the claims stack. There is no second
 * layout, and no appearance prop: at 1200 px the claims flow about 2.6 to a line (§3.1), and at
 * 24 rem every basis is wider than the space left.
 */
const WIDTH = {
  short: 'basis-[17rem]',
  date: 'basis-[20rem]',
  medium: 'basis-[26rem]',
  line: 'basis-full',
} as const;

export function EntityRecord({ rows, mark }: EntityRecordProps) {
  return (
    // `@container` makes the name column read the width of the pane and not of the window.
    // §4.1: only the width of the name changes between the page and the sidebar.
    <div className="@container flex flex-wrap items-start gap-x-3 gap-y-1">
      {rows.map((row) =>
        row.kind === 'group' ? (
          <h2 key={row.key} className="flex basis-full items-baseline gap-2 pt-2">
            {/* The group name takes the first step of the text ladder, and the claim labels
                below it take the third. **The defect this exists to not repeat:** the name was
                the smallest size on the quietest token, so the heading was the faintest text in
                the record and it did not outrank what it groups. The uppercase and the tracking
                went with it: that recipe belongs to a small table header, and a record is not a
                table. `./claims` already writes each group name in sentence case. */}
            <span className="text-xs text-foreground">{row.label}</span>
            <span className="font-mono text-[11px]/4 text-label">{row.count}</span>
          </h2>
        ) : (
          <div
            // The key carries the shape of the control as well as the domain identifier of the
            // row. **The defect this exists to not repeat:** the attribute set declares no type
            // (§3.2), so one key can hold `true` on one entity and `under review` on another.
            // With the key alone React kept the same `<input>` element and reconciled a
            // `checked` control into a `defaultValue` one. A key that names the shape makes
            // React replace the element instead. **Do not shorten it back to `row.key`.**
            key={`${row.key}/${row.claim.value.control}`}
            data-claim=""
            className={cn('flex min-w-0 grow items-center gap-1.5', WIDTH[row.claim.width])}
          >
            {/* Rule 16: a value truncates and the full one appears on hover. `truncate` alone
                does nothing in a flex row, so `min-w-0` and `shrink-0` sit beside it. */}
            <span
              className="w-24 shrink-0 truncate text-xs text-label @md:w-32"
              title={row.claim.label}
            >
              {row.claim.label}
            </span>
            {/* §3.2: the control is a guess, and the guess is said out loud. It is a hidden
                span and not the `title` of the cell, because the `title` of the value already
                carries the full value (rule 16), and a second one over the whole cell would
                cover it. This way the guess reaches a reader on every claim and never
                competes with the value. */}
            <span className="sr-only">{row.claim.controlWord}</span>
            <span className="min-w-0 flex-1">
              <Field label={row.claim.label} value={row.claim.value} />
            </span>
            {/* §5.1: the mark is last in the cell, and it is inside nothing that can hide it. */}
            {mark(row.sources)}
          </div>
        ),
      )}
    </div>
  );
}
