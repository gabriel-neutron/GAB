import type { PairRating } from '@gab/release/site-release';

export interface NatoPairMarkProps {
  readonly rating: PairRating;
}

/** The ADMIRALTY pair of a claim in words. A claim with no full pair says "not rated", and a
 * release that hides the pair shows nothing. */
export function NatoPairMark({ rating }: NatoPairMarkProps) {
  if (!rating.shown) return null;
  return (
    <span className="font-mono text-muted-foreground" data-nato-pair="">
      {rating.pair === null ? 'Not rated' : `Admiralty ${rating.pair.letter}${rating.pair.digit}`}
    </span>
  );
}
