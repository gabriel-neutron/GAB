import { Split } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

import { ChangeMark } from './change-mark';
import { CitedPassages } from './cited-passages';
import { Difference } from './difference';
import { Holes } from './holes';
import type { ActPassages } from './passages';
import type { Change } from './queue';
import { SourceBadge } from './sources';

export interface ChangeCardProps {
  readonly change: Change;
  /** The act the controls at the foot act on. Two cards stand open when a key is contested. */
  readonly current: boolean;
  readonly passages: ActPassages;
}

const DISPUTED = 'A check disputes this act.';

export function ChangeCard({ change, current, passages }: ChangeCardProps) {
  // A row of an update carries the documents of the act. A row of a deletion carries the documents
  // of the lost value, so a deletion shows the documents of the act as well as its rows.
  const actSources =
    (change.rows.length === 0 || change.kind === 'delete') && change.sources.length > 0;

  return (
    <article
      data-change={change.id}
      aria-current={current ? 'true' : undefined}
      className={cn(
        // The left rule and the raised ground say which card the controls act on. A word cannot:
        // at the width of two cards it is clipped, and it is clipped where it matters most.
        'flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto p-2',
        'overscroll-contain border border-border border-l-2',
        current ? 'border-l-primary bg-card' : 'border-l-transparent',
      )}
    >
      <span className="sr-only">
        {current ? 'The controls act on this one' : 'Read beside the act under the controls'}
      </span>

      <div className="flex h-6 shrink-0 items-center gap-2">
        <ChangeMark kind={change.kind} kindWords={change.kindWords} />
        {/* A disagreement is a mark and never a sentence. */}
        {change.disputed ? (
          <span
            data-disputed
            title={DISPUTED}
            className="inline-flex shrink-0 items-center gap-1 text-small/4 text-dissent"
          >
            <Split size={14} aria-hidden="true" />
            disputed
            <span className="sr-only">{DISPUTED}</span>
          </span>
        ) : null}
      </div>

      {passages.state === 'held' && passages.dispute !== null ? (
        <p data-dispute className="text-small/4 text-dissent">
          <span className="sr-only">Why it is disputed: </span>
          {passages.dispute}
        </p>
      ) : null}

      {change.headline === '' ? null : <p className="text-xs">{change.headline}</p>}

      {actSources ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="sr-only">The documents this act stands on</span>
          {change.sources.map((source) => (
            <SourceBadge key={source.id} source={source} />
          ))}
        </div>
      ) : null}

      <CitedPassages cited={passages} />

      {change.rows.length === 0 ? null : (
        <Difference rows={change.rows} rowSources={change.rowSources} />
      )}

      <Holes holes={change.holes} />
    </article>
  );
}
