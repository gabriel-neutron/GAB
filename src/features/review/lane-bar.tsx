import { cn } from '@/shared/lib/utils';

import { laneSummary } from './lane-words';
import type { Lane, LaneCounts } from './unit-page';

export interface LaneBarProps {
  readonly lane: Lane;
  readonly counts: LaneCounts;
  readonly onLane: (lane: Lane) => void;
}

const CONTROL = cn(
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'transition-colors duration-100 hover:bg-muted',
);

const LISTS: readonly { readonly lane: Lane; readonly words: string }[] = [
  { lane: 'doubt', words: 'Doubts' },
  { lane: 'waiting', words: 'Waiting' },
];

/** The head of the queue: what the rules decided, and the two lists that are left. The doubts are
 * the units that the operator decides. The other list holds the units that wait for a source. */
export function LaneBar({ lane, counts, onLane }: LaneBarProps) {
  return (
    <div className="shrink-0 space-y-1 border-b border-border p-1">
      <p data-said="rules" className="px-1 text-small/4 text-label">
        {laneSummary(counts)}
      </p>
      <nav aria-label="Lists of the queue" className="flex gap-1">
        {LISTS.map((held) => (
          <button
            key={held.lane}
            type="button"
            aria-current={held.lane === lane ? 'true' : undefined}
            onClick={() => {
              onLane(held.lane);
            }}
            className={cn(
              CONTROL,
              'h-6 flex-1 border px-2 text-xs',
              held.lane === lane ? 'border-primary bg-muted text-foreground' : 'border-input',
            )}
          >
            {held.words}
            <span className="font-mono tabular-nums text-label"> · {counts[held.lane]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
