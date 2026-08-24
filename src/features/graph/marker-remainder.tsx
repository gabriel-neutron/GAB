import { cn } from '@/shared/lib/utils';

export interface MarkerRemainderProps {
  /** How many lit elements carry a marker. */
  readonly drawn: number;
  /** How many lit elements carry pending evidence and no marker. */
  readonly remainder: number;
}

// The line appears only where the cut bites. A marker means that pending evidence sits here, so an
// element with none reads as clear, and past the cut that reading is false. At a remainder of zero
// the sentence states nothing that the picture does not already say.
export function MarkerRemainder({ drawn, remainder }: MarkerRemainderProps) {
  if (remainder <= 0) return null;

  return (
    <p
      role="status"
      data-marker-remainder={remainder}
      className={cn(
        'pointer-events-none max-w-80 border border-border bg-popover px-2 py-1',
        'text-xs text-popover-foreground',
      )}
    >
      The graph marks {drawn} of {drawn + remainder}, most pending evidence first. {remainder}{' '}
      {remainder === 1 ? 'element carries' : 'elements carry'} pending evidence and no marker.
    </p>
  );
}
