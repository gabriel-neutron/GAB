import { folded } from '@/shared/text-fold';

// The text of the record does not change while a query is typed, so each text is folded once.
// The memory holds only the texts of the record: a query is folded with no memory.
const memory = new Map<string, string>();

// A record of a few thousand entities holds far fewer texts. A memory past this size holds the
// texts of older reads too, so it starts again.
const MOST_TEXTS = 100_000;

/** The fold of a text of the record, as `folded` gives it. */
export function foldedOnce(text: string): string {
  const held = memory.get(text);
  if (held !== undefined) return held;
  if (memory.size >= MOST_TEXTS) memory.clear();
  const fold = folded(text);
  memory.set(text, fold);
  return fold;
}
