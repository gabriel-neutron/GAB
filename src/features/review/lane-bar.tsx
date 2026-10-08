import { cn } from '@/shared/lib/utils';

import { LISTS, laneSummary } from './lane-words';
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

/** The head of the queue: what the rules decided, and the two lists that are left. The doubts are
 * the units that the operator decides. The other list holds the units that wait for a source. */
export function LaneBar({ lane, counts, onLane }: LaneBarProps) {
  return (
    <div className="shrink-0 space-y-1 border-b border-border p-1">
      <p data-said="rules" className="px-1 text-small/4 text-label">
        {laneSummary(counts)}
      </p>
      <nav aria-label="Lists of the queue" className="flex gap-1">
        {LISTS.map((list) => (
          <button
            key={list.lane}
            type="button"
            aria-current={list.lane === lane ? 'true' : undefined}
            onClick={() => {
              onLane(list.lane);
            }}
            className={cn(
              CONTROL,
              'h-6 flex-1 border px-2 text-xs',
              list.lane === lane ? 'border-primary bg-muted text-foreground' : 'border-input',
            )}
          >
            {list.words}
            <span className="font-mono tabular-nums text-label"> · {counts[list.lane]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
