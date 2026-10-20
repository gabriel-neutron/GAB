import { cn } from '@/shared/lib/utils';

interface UnplacedCountProps {
  /** How many entities have no place, and the canvas draws on the ring. */
  readonly unplaced: number;
  /** Whether the canvas draws them. */
  readonly shown: boolean;
  readonly onSwitch: (show: boolean) => void;
}

// An entity on the ring stands where its identifier puts it and not where the corpus puts it, so
// the picture around it is false. At a count of zero every entity is placed, and the sentence
// would state what the picture already says.
export function UnplacedCount({ unplaced, shown, onSwitch }: UnplacedCountProps) {
  if (unplaced <= 0) return null;

  return (
    <div
      role="status"
      data-unplaced-count={unplaced}
      className={cn('flex max-w-prose flex-wrap items-center gap-x-2 text-muted-foreground')}
    >
      <p>
        {unplaced === 1
          ? '1 new entity has no place yet. Its place on the ring means nothing.'
          : `${String(unplaced)} new entities have no place yet. Their place on the ring means nothing.`}{' '}
        {shown ? 'Grey dots on the outer ring are the entities with no place.' : null}
      </p>
      <button
        type="button"
        onClick={() => {
          onSwitch(!shown);
        }}
        className={cn(
          'h-6 border border-input bg-background px-2 text-xs text-foreground',
          'transition-colors duration-100 hover:bg-muted',
          'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        )}
      >
        {shown ? 'Hide them' : 'Show them'}
      </button>
    </div>
  );
}
