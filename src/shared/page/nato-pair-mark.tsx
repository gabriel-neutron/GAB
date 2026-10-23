import type { PairRating } from '@gab/release/site-release';

import { pairWords } from './admiralty-words';

export interface NatoPairMarkProps {
  readonly rating: PairRating;
}

/** The ADMIRALTY pair of a claim as a badge. The words that explain it are in the native tooltip
 * and in the accessible name: a custom tooltip would be cut by the scroll box of a table. A claim
 * with no full pair says "not rated", and a release that hides the pair shows nothing. */
export function NatoPairMark({ rating }: NatoPairMarkProps) {
  if (!rating.shown) return null;
  if (rating.pair === null)
    return (
      <span
        className="text-muted-foreground"
        data-nato-pair=""
        title="No full rating is known for this claim: the author of its source or its credibility is not rated."
      >
        Not rated
      </span>
    );
  const { letter, digit } = rating.pair;
  const words = pairWords(letter, digit);
  return (
    <span
      role="img"
      title={words}
      aria-label={`Admiralty ${letter}${digit}. ${words}`}
      className="inline-block cursor-help border border-input px-1 font-mono text-small/4 font-medium "
      data-nato-pair=""
    >
      {`${letter}${digit}`}
    </span>
  );
}
