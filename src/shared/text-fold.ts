import { foldLookalikes } from '@gab/proposal/lookalikes';

// One fold, shared by every search over the corpus: case and accent drop away, a Cyrillic letter
// that looks like a Latin letter becomes that Latin letter, and a run of whitespace becomes one
// space, so a query and a stored value compare on the same ground.

const COMBINING_MARK = /\p{M}/gu;

export const folded = (text: string): string =>
  foldLookalikes(text.normalize('NFD').replace(COMBINING_MARK, '').toLowerCase())
    .replace(/\s+/g, ' ')
    .trim();
