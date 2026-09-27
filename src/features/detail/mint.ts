/** A claim the entity does not hold yet: the key, the value, and the kind the value takes. The
 * record corrects a key that stands; this makes one that does not. Two boxes are read into one
 * act, or into one sentence, so the reader and the words of the reader are one job. */

import { ATTRIBUTE_KEY, ATTRIBUTE_KEY_LENGTH } from '@gab/proposal/attribute-value';
import type { AttributeEdit } from '@gab/proposal/attribute-value';

import type { ClaimControl } from './claims';
import type { RecordRow } from './dossier';
import { readUndeclaredValue } from './entry';

/** What is typed into the two boxes. It dies with the view, as every half-typed value does. */
export interface MintForm {
  readonly key: string;
  readonly text: string;
}

/** The act one minted claim carries, or the sentence that says why no act can be made. The kind
 * is carried out so that the analyst reads it before the act leaves the browser. */
export type MintDraft =
  | {
      readonly ready: true;
      readonly attrs: AttributeEdit;
      readonly control: Exclude<ClaimControl, 'list'>;
    }
  | { readonly ready: false; readonly refusal: string };

const NOTHING = 'Write a key and a value.';

const NO_KEY = 'Write the key of the claim.';

const NO_VALUE = 'Write the value of the claim.';

// The same two rules `attrs_valid` holds in the record. The sentence states each part of the
// shape, because `coal__stock` and `coal_stock_` break a rule that a shorter sentence hides.
const KEY_SHAPE =
  'A key is lower case words of letters and digits, joined by one underscore.' +
  ' It starts with a letter, and it ends with a letter or a digit: coal_stock_t.';

const KEY_LENGTH = `A key is ${String(ATTRIBUTE_KEY_LENGTH)} characters at most.`;

const STANDS_ALREADY = 'This entity holds that key. Correct its value in the record above.';

const refused = (refusal: string): MintDraft => ({ ready: false, refusal });

/** One minted claim, read from the two boxes. */
export function readMint(rows: readonly RecordRow[], form: MintForm): MintDraft {
  const key = form.key.trim();
  const text = form.text;

  if (key === '' && text.trim() === '') return refused(NOTHING);
  if (key === '') return refused(NO_KEY);
  if (key.length > ATTRIBUTE_KEY_LENGTH) return refused(KEY_LENGTH);
  if (!ATTRIBUTE_KEY.test(key)) return refused(KEY_SHAPE);
  if (rows.some((row) => row.claim.key === key)) return refused(STANDS_ALREADY);
  if (text.trim() === '') return refused(NO_VALUE);

  const { control, entry } = readUndeclaredValue(text);
  if (!entry.held) return refused(entry.refusal);
  return { ready: true, attrs: { [key]: { v: entry.value } }, control };
}

// External constraint: a number is a double, so `41.50` lands as `41.5`. The sentence states
// that loss, because nothing on the screen can undo it afterwards.
const READS = {
  boolean: 'The value reads as a yes or a no.',
  number: 'The value reads as a number. A number drops a trailing zero.',
  date: 'The value reads as a day of the calendar.',
  text: 'The value reads as text. A comma makes no list here.',
  note: 'The value reads as text. A comma makes no list here.',
} as const;

// M8: the writer adds `manual` to every key it edits, and a minted key cites nothing else. The
// sentence states the citation before the act, because the claim rests on the operator alone.
const SIGNED = 'It will be signed manual.';

/** The one sentence the control reads, and it never composes it in the view. */
export function mintWords(draft: MintDraft): string {
  return draft.ready ? `${READS[draft.control]} ${SIGNED}` : draft.refusal;
}
