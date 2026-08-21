import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

import type { RecordRow, SourceRef } from './dossier';
import { Field } from './field';

export interface EntityRecordProps {
  readonly rows: readonly RecordRow[];
  readonly mark: (sources: readonly SourceRef[]) => ReactNode;
}

// Each cell is `grow min-w-0`. At 1200 px the claims flow about 2.6 to a line; at the
// 24 rem sidebar every basis is wider than the space left, so one cell fills the line.
const WIDTH = {
  short: 'basis-[17rem]',
  date: 'basis-[20rem]',
  medium: 'basis-[26rem]',
  line: 'basis-full',
} as const;

export function EntityRecord({ rows, mark }: EntityRecordProps) {
  return (
    // `@container` makes the name column read the width of the pane, not of the window.
    <div className="@container flex flex-wrap items-start gap-x-3 gap-y-1">
      {rows.map((row) => (
        <div
          // React reconciles by key alone: one key can hold a `checked` control on one entity
          // and a `defaultValue` one on another. The shape in the key makes React replace the
          // element instead of reconciling across control types.
          key={`${row.key}/${row.claim.value.control}`}
          data-claim=""
          className={cn('flex min-w-0 grow items-center gap-1.5', WIDTH[row.claim.width])}
        >
          {/* Tailwind: `truncate` does nothing in a flex row without `min-w-0`. */}
          <span
            className="w-24 shrink-0 truncate text-xs text-label @md:w-32"
            title={row.claim.label}
          >
            {row.claim.label}
          </span>
          <span className="min-w-0 flex-1">
            <Field label={row.claim.label} value={row.claim.value} />
          </span>
          {mark(row.sources)}
        </div>
      ))}
    </div>
  );
}
