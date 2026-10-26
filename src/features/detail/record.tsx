import type { ReactNode } from 'react';

import type { TypedValue } from './claims';
import type { RecordCell } from './draft';
import type { SourceRef } from './dossier';
import { Field } from './field';
import { CAPTION, DATA, GHOST_LINK } from './style';

export type EntityRecordProps =
  | {
      readonly mode: 'reading';
      readonly cells: readonly RecordCell[];
      readonly mark: (sources: readonly SourceRef[]) => ReactNode;
      /** The address of the claim page of one key, or null where the release holds no such claim. */
      readonly claimHref?: (key: string) => string | null;
      /** False on a site of a release: a reader sees the readable name and no stored key. */
      readonly showKey?: boolean;
    }
  | {
      readonly mode: 'writing';
      readonly cells: readonly RecordCell[];
      readonly mark: (sources: readonly SourceRef[]) => ReactNode;
      readonly claimHref?: (key: string) => string | null;
      readonly onEdit: (key: string, typed: TypedValue) => void;
      readonly showKey?: boolean;
    };

export function EntityRecord(props: EntityRecordProps) {
  const onEdit = props.mode === 'writing' ? props.onEdit : null;
  const claimLink = (key: string): string | null => props.claimHref?.(key) ?? null;

  // Two columns: the key, and the value with its marks. A value wraps and is never cut. The key
  // column fits the longest key up to 11rem, and a key longer than that breaks anywhere.
  return (
    <div className="grid grid-cols-[fit-content(11rem)_minmax(0,1fr)] gap-x-4">
      {props.cells.map((cell) => (
        <div
          key={cell.key}
          data-claim=""
          className="col-span-2 grid grid-cols-subgrid border-b border-divider py-2 first:pt-0 last:border-b-0"
        >
          <span title={cell.help === null ? cell.label : `${cell.label}. ${cell.help}`}>
            <span className={`block [overflow-wrap:anywhere] ${CAPTION}`}>{cell.label}</span>
            {/* The stored key, in a secondary place, for the analyst who looks for the raw word.
                A reader of a release sees the readable name only. */}
            {props.showKey === false ? null : (
              <span className={`block [overflow-wrap:anywhere] ${DATA} text-muted-foreground`}>
                {cell.key}
              </span>
            )}
          </span>
          <span className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-1">
            <span className="min-w-0 flex-1 basis-24">
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
            <span className="flex shrink-0 items-center gap-2">
              {props.mark(cell.sources)}
              {claimLink(cell.key) === null ? null : (
                <a
                  className={`${GHOST_LINK} shrink-0 text-body-sm`}
                  href={claimLink(cell.key) ?? undefined}
                  aria-label={`Claim: ${cell.label}`}
                >
                  Claim
                </a>
              )}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
