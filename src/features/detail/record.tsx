import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

import type { TypedValue } from './claims';
import type { RecordCell } from './draft';
import type { SourceRef } from './dossier';
import { Field } from './field';

export type EntityRecordProps =
  | {
      readonly mode: 'reading';
      readonly cells: readonly RecordCell[];
      readonly mark: (sources: readonly SourceRef[]) => ReactNode;
    }
  | {
      readonly mode: 'writing';
      readonly cells: readonly RecordCell[];
      readonly mark: (sources: readonly SourceRef[]) => ReactNode;
      readonly onEdit: (key: string, typed: TypedValue) => void;
    };

// Each cell is `grow min-w-0`. At 1200 px the claims flow about 2.6 to a line; at the
// 24 rem sidebar every basis is wider than the space left, so one cell fills the line.
const WIDTH = {
  short: 'basis-[17rem]',
  date: 'basis-[20rem]',
  medium: 'basis-[26rem]',
  line: 'basis-full',
} as const;

export function EntityRecord(props: EntityRecordProps) {
  const onEdit = props.mode === 'writing' ? props.onEdit : null;

  return (
    // `@container` makes the name column read the width of the pane, not of the window.
    <div className="@container flex flex-wrap items-start gap-x-3 gap-y-1">
      {props.cells.map((cell) => (
        <div
          key={cell.key}
          data-claim=""
          className={cn('flex min-w-0 grow items-center gap-1.5', WIDTH[cell.width])}
        >
          {/* Tailwind: `truncate` does nothing in a flex row without `min-w-0`. */}
          <span className="w-24 shrink-0 truncate text-xs text-label @md:w-32" title={cell.label}>
            {cell.label}
          </span>
          <span className="min-w-0 flex-1">
            {cell.editable && onEdit !== null ? (
              <Field
                mode="writing"
                label={cell.label}
                draft={{ value: cell.value, refusal: cell.refusal }}
                onEdit={(typed) => {
                  onEdit(cell.key, typed);
                }}
              />
            ) : (
              <Field mode="reading" label={cell.label} value={cell.value} note={cell.note} />
            )}
          </span>
          {props.mark(cell.sources)}
        </div>
      ))}
    </div>
  );
}
