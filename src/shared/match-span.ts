import { folded } from './text-fold';

export interface MatchPart {
  readonly text: string;
  readonly matched: boolean;
}

const MARK = /^\p{M}$/u;
const SPACE = /^\s$/u;

/** Splits a name into the text before, in and after the first match of the query. The match
 * ignores case and accents, as the filter does. A name with no match is one unmarked part. */
export function matchParts(name: string, query: string): readonly MatchPart[] {
  const needle = folded(query);
  const whole: readonly MatchPart[] = [{ text: name, matched: false }];
  if (needle === '') return whole;
  // Departure: `folded` works on a whole text, so a match is a slice of the name whose own fold
  // equals the query. A fold per character would differ from the fold of the text (a run of
  // spaces, a final sigma), and the row would hold the filter with no mark.
  const points = Array.from(name);
  const at: number[] = [];
  let offset = 0;
  for (const point of points) {
    at.push(offset);
    offset += point.length;
  }
  at.push(offset);
  for (let start = 0; start < points.length; start += 1) {
    const first = points[start] ?? '';
    if (SPACE.test(first) || MARK.test(first)) continue;
    for (let end = start + 1; end <= points.length; end += 1) {
      const slice = name.slice(at[start], at[end]);
      const seen = folded(slice);
      if (seen.length > needle.length) break;
      if (seen !== needle) continue;
      let last = end;
      while (last < points.length && MARK.test(points[last] ?? '')) last += 1;
      const from = at[start] ?? 0;
      const to = at[last] ?? name.length;
      return [
        { text: name.slice(0, from), matched: false },
        { text: name.slice(from, to), matched: true },
        { text: name.slice(to), matched: false },
      ].filter((part) => part.text !== '');
    }
  }
  return whole;
}
