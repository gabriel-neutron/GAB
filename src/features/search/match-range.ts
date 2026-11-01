import { foldLookalikes } from '@gab/proposal/lookalikes';

import { folded } from '@/shared/text-fold';

export interface MatchRange {
  readonly start: number;
  readonly end: number;
}

const COMBINING_MARK = /^\p{M}$/u;
const SPACE = /^\s$/u;

/** Where the first fold-equal match of the query sits in the original text, as string offsets.
 * It folds the text in the way `folded` does, and it keeps the offset of each folded character. */
export function matchRange(text: string, query: string): MatchRange | null {
  const asked = folded(query);
  if (asked === '') return null;

  let flat = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  let spaced = false;
  for (const point of text) {
    const next = offset + point.length;
    for (const piece of point.normalize('NFD')) {
      if (COMBINING_MARK.test(piece)) continue;
      if (SPACE.test(piece)) {
        if (spaced) {
          ends[ends.length - 1] = next;
        } else {
          flat += ' ';
          starts.push(offset);
          ends.push(next);
          spaced = true;
        }
        continue;
      }
      spaced = false;
      for (const char of foldLookalikes(piece.toLowerCase())) {
        flat += char;
        starts.push(offset);
        ends.push(next);
      }
    }
    offset = next;
  }

  const at = flat.indexOf(asked);
  if (at === -1) return null;
  const start = starts[at];
  const end = ends[at + asked.length - 1];
  return start === undefined || end === undefined ? null : { start, end };
}
