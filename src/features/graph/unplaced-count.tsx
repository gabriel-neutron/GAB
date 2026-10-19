import { cn } from '@/shared/lib/utils';

interface UnplacedCountProps {
  /** How many entities the layout run never placed, and the canvas draws on the band. */
  readonly unplaced: number;
}

// An entity on the band stands where its identifier puts it and not where the corpus puts it, so
// the picture around it is false. At a count of zero every entity is placed, and the sentence
// would state what the picture already says.
export function UnplacedCount({ unplaced }: UnplacedCountProps) {
  if (unplaced <= 0) return null;

  return (
    <p
      role="status"
      data-unplaced-count={unplaced}
      className={cn('max-w-prose text-muted-foreground')}
    >
      The layout run placed no position for {unplaced}{' '}
      {unplaced === 1 ? 'entity. It stands' : 'entities. They stand'} on the outer band, at a place
      read from the identifier.
    </p>
  );
}
