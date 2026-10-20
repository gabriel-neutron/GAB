import type { PairRating } from '@gab/release/site-release';

import { pairWords } from './admiralty-words';

export interface NatoPairMarkProps {
  readonly rating: PairRating;
}

/** The ADMIRALTY pair of a claim: the two marks, then the same in words. A claim with no full pair
 * says "not rated", and a release that hides the pair shows nothing. */
export function NatoPairMark({ rating }: NatoPairMarkProps) {
  if (!rating.shown) return null;
  if (rating.pair === null)
    return (
      <span className="text-muted-foreground" data-nato-pair="">
        Not rated
      </span>
    );
  const { letter, digit } = rating.pair;
  return (
    <span data-nato-pair="">
      <span className="font-mono font-medium">{`${letter}${digit}`}</span>
      <span className="text-muted-foreground">{` · ${pairWords(letter, digit)}`}</span>
    </span>
  );
}
