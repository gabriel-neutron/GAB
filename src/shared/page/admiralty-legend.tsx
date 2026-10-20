export interface AdmiraltyLegendProps {
  /** True when the release shows the pair. */
  readonly shown: boolean;
}

/** The meaning of the letter and of the digit, once for a page that shows pairs. */
export function AdmiraltyLegend({ shown }: AdmiraltyLegendProps) {
  if (!shown) return null;
  return (
    <p className="max-w-prose text-xs/5 text-muted-foreground" data-admiralty-legend="">
      Admiralty pair: the letter, from A (reliable) to F (cannot be judged), rates the author of the
      source. The digit, from 1 (confirmed by independent sources) to 6 (cannot be judged), rates
      the fact. The pair is the same for all documents of a claim. A claim with no full pair is not
      rated.
    </p>
  );
}
