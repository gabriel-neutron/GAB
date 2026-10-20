export interface AdmiraltyLegendProps {
  /** True when the release shows the pair. */
  readonly shown: boolean;
}

/** One line for a page that lists pairs. A single claim spells its pair in words instead. */
export function AdmiraltyLegend({ shown }: AdmiraltyLegendProps) {
  if (!shown) return null;
  return (
    <p className="text-xs/5 text-muted-foreground" data-admiralty-legend="">
      Rating: the letter (A to F) is the author, the digit (1 to 6) is the fact.
    </p>
  );
}
