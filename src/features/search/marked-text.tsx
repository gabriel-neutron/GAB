import { matchRange } from './match-range';

interface MarkedTextProps {
  readonly text: string;
  readonly query: string;
}

/** The text with its first match of the query set in a mark. A mark has a fill and a weight, so
 * a hue is not the only sign of the match. */
export function MarkedText({ text, query }: MarkedTextProps) {
  const range = matchRange(text, query);
  if (range === null) return text;
  return (
    <>
      {text.slice(0, range.start)}
      <mark className="bg-accent font-medium text-accent-foreground underline decoration-2 underline-offset-2">
        {text.slice(range.start, range.end)}
      </mark>
      {text.slice(range.end)}
    </>
  );
}
