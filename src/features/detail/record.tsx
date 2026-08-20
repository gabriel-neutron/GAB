/**
 * The claims of one entity, grouped and flowing.
 *
 * The mark of the source sits in every claim cell, and no control hides it.
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
  /** The mark to the source. The caller owns which source is active and what a click does. */
  readonly mark: (sources: readonly SourceRef[]) => ReactNode;
}

/**
 * The four widths, as classes. A derivation holds no class string, so the name arrives
 * from `./claims` and this table turns it into a width.
 *
 * **One rule serves the page and the 24 rem sidebar.** Each cell is `grow min-w-0`, so a basis
 * wider than the pane makes one cell fill the line and the claims stack. There is no second
 * layout, and no appearance prop: at 1200 px the claims flow about 2.6 to a line, and at
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
    // Only the width of the name changes between the page and the sidebar.
    <div className="@container flex flex-wrap items-start gap-x-3 gap-y-1">
      {rows.map((row) => (
        <div
          // The key carries the shape of the control as well as the domain identifier of the
          // row. **The defect this exists to not repeat:** the attribute set declares no type
          // so one key can hold `true` on one entity and `under review` on another.
          // With the key alone React kept the same `<input>` element and reconciled a
          // `checked` control into a `defaultValue` one. A key that names the shape makes
          // React replace the element instead. **Do not shorten it back to `row.key`.**
          key={`${row.key}/${row.claim.value.control}`}
          data-claim=""
          className={cn('flex min-w-0 grow items-center gap-1.5', WIDTH[row.claim.width])}
        >
          {/* A value truncates and the full one appears on hover. `truncate` alone
                does nothing in a flex row, so `min-w-0` and `shrink-0` sit beside it. */}
          <span
            className="w-24 shrink-0 truncate text-xs text-label @md:w-32"
            title={row.claim.label}
          >
            {row.claim.label}
          </span>
          <span className="min-w-0 flex-1">
            <Field label={row.claim.label} value={row.claim.value} />
          </span>
          {/* The mark is last in the cell, and it is inside nothing that can hide it. */}
          {mark(row.sources)}
        </div>
      ))}
    </div>
  );
}
