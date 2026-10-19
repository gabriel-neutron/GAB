import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

export interface KeyValueEntry {
  readonly key: string;
  /** Null is an absent value: the key stays and its cell is blank. */
  readonly value: ReactNode;
  /** An identifier, a date or a count, drawn in the monospace face. */
  readonly figure?: true;
}

export interface KeyValueProps {
  readonly entries: readonly KeyValueEntry[];
}

/** The facts of one record, one key and one value on each line. */
export function KeyValue({ entries }: KeyValueProps) {
  return (
    <dl className="grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-4 gap-y-1">
      {entries.map((entry) => (
        <div key={entry.key} className="contents">
          <dt className="max-w-40 text-label sm:max-w-none">{entry.key}</dt>
          <dd
            className={cn(
              'min-w-0 break-words',
              entry.figure === true && 'font-mono tabular-nums break-all',
            )}
          >
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
