import type { NatoPair } from '@gab/release/site-release';

export interface NatoPairMarkProps {
  readonly pair: NatoPair | null;
}

/** The NATO pair of a claim, in words and in its two marks. Nothing when the claim has none, so
 * a release that does not show the pair shows no mark. */
export function NatoPairMark({ pair }: NatoPairMarkProps) {
  if (pair === null) return null;
  return (
    <span className="font-mono text-muted-foreground" data-nato-pair="">
      {`NATO ${pair.letter}${pair.digit}`}
    </span>
  );
}
