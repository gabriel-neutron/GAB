// One fold, shared by every search over the corpus: case and accent drop away, and a run of
// whitespace becomes one space, so a query and a stored value compare on the same ground.

const COMBINING_MARK = /\p{M}/gu;

export const folded = (text: string): string =>
  text.normalize('NFD').replace(COMBINING_MARK, '').toLowerCase().replace(/\s+/g, ' ').trim();
