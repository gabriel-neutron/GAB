import { cn } from '@/shared/lib/utils';

interface FocusBarProps {
  readonly hops: 1 | 2;
  /** The neighbours of the selected entity that the focus does not draw. Zero turns the ask off. */
  readonly expandable: number;
  readonly onHops: (hops: 1 | 2) => void;
  readonly onExpand: () => void;
  readonly onBack: () => void;
}

const BUTTON_CLASS = cn(
  'h-6 border border-input bg-background px-2 text-xs text-foreground',
  'transition-colors duration-100 hover:bg-muted disabled:text-muted-foreground',
  'disabled:hover:bg-background',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

const HOPS: readonly (1 | 2)[] = [1, 2];

export function FocusBar({ hops, expandable, onHops, onExpand, onBack }: FocusBarProps) {
  return (
    <div className={cn('absolute top-2 left-2 z-10 flex flex-wrap items-center gap-1')}>
      <div role="group" aria-label="Reach of the focus" className="flex">
        {HOPS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={hops === value}
            onClick={() => {
              onHops(value);
            }}
            className={cn(
              BUTTON_CLASS,
              'aria-pressed:border-foreground aria-pressed:bg-muted aria-pressed:font-medium',
            )}
          >
            {value === 1 ? '1 hop' : '2 hops'}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={expandable === 0}
        onClick={onExpand}
        title={
          expandable === 0 ? 'Select a node that has neighbours the graph does not draw' : undefined
        }
        className={BUTTON_CLASS}
      >
        {expandable === 0 ? 'Expand this node' : `Expand this node (${String(expandable)} more)`}
      </button>
      <button type="button" onClick={onBack} className={BUTTON_CLASS}>
        Back to the whole graph
      </button>
    </div>
  );
}
