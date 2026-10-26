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

  // Two columns: the key, and the value with its marks. A value wraps and is never cut.
  return (
    <div className="flex flex-col">
      {props.cells.map((cell) => (
        <div
          key={cell.key}
          data-claim=""
          className="grid grid-cols-[minmax(6rem,8rem)_minmax(0,1fr)] gap-x-4 gap-y-1 border-b border-divider py-2 first:pt-0 last:border-b-0"
        >
          <span title={cell.help === null ? cell.label : `${cell.label}. ${cell.help}`}>
            <span className={`block min-w-0 break-words ${CAPTION}`}>{cell.label}</span>
            {/* The stored key, in a secondary place, for the analyst who looks for the raw word.
                A reader of a release sees the readable name only. */}
            {props.showKey === false ? null : (
              <span className={`block min-w-0 break-words ${DATA} text-muted-foreground`}>
                {cell.key
                  .split('_')
                  .flatMap((part, at) => (at === 0 ? [part] : ['_', <wbr key={at} />, part]))}
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
