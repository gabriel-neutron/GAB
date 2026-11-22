import { matchParts } from '@/shared/match-span';

export interface MatchRange {
  readonly start: number;
  readonly end: number;
}

/** Where the first fold-equal match of the query sits in the original text, as string offsets.
 * The shared split finds the match, so the mark agrees with the fold of the whole text. */
export function matchRange(text: string, query: string): MatchRange | null {
  let start = 0;
  for (const part of matchParts(text, query)) {
    if (part.matched) return { start, end: start + part.text.length };
    start += part.text.length;
  }
  return null;
}
