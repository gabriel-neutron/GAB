import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';
import { READING_LINK } from '@/shared/page/reading-link';

import type { TypedValue } from './claims';
import type { RecordCell } from './draft';
import type { SourceRef } from './dossier';
import { Field } from './field';

export type EntityRecordProps =
  | {
      readonly mode: 'reading';
      readonly cells: readonly RecordCell[];
      readonly mark: (sources: readonly SourceRef[]) => ReactNode;
      /** The address of the claim page of one key, or null where the release holds no such claim. */
      readonly claimHref?: (key: string) => string | null;
    }
  | {
      readonly mode: 'writing';
      readonly cells: readonly RecordCell[];
      readonly mark: (sources: readonly SourceRef[]) => ReactNode;
      readonly claimHref?: (key: string) => string | null;
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
  const claimLink = (key: string): string | null => props.claimHref?.(key) ?? null;

  return (
    // `@container` makes the name column read the width of the pane, not of the window.
    <div className="@container flex flex-wrap items-start gap-x-3 gap-y-1">
      {props.cells.map((cell) => (
        <div
          key={cell.key}
          data-claim=""
          className={cn('flex min-w-0 grow items-center gap-1.5', WIDTH[cell.width])}
        >
          {/* The name is set against its value. The column has a fixed width, so a name at its
              left edge leaves its slack beside the value, and it reads as attached to the cell
              on its left. Tailwind: `truncate` does nothing in a flex row without `min-w-0`. */}
          <span
            className="flex w-24 shrink-0 flex-col items-end text-right @md:w-32"
            title={cell.help === null ? cell.label : `${cell.label}. ${cell.help}`}
          >
            <span className="w-full min-w-0 text-xs break-words text-label">{cell.label}</span>
            {/* The stored key, in a secondary place, for a reader who looks for the raw word. */}
            <span className="w-full min-w-0 font-mono break-all text-small/4 text-muted-foreground">
              {cell.key}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            {onEdit !== null ? (
              <Field
                mode="writing"
                label={cell.label}
                draft={{ value: cell.value, refusal: cell.refusal }}
                onEdit={(typed) => {
                  onEdit(cell.key, typed);
                }}
              />
            ) : (
              <Field mode="reading" label={cell.label} value={cell.value} />
            )}
          </span>
          {props.mark(cell.sources)}
          {claimLink(cell.key) === null ? null : (
            <a
              className={cn(READING_LINK, 'shrink-0 text-xs')}
              href={claimLink(cell.key) ?? undefined}
              aria-label={`Claim: ${cell.label}`}
            >
              Claim
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
