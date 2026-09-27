/** Typed text back into an attribute value, in the control it was typed into. The database is
 * the second tier and refuses what this misses; this tier gives a sentence before a round trip.
 * The reader of the kind stands here too, and it names the control that `readEntry` reads. */

import type { AttributeValue } from '@/shared/read/model';

import { type ClaimControl, type ClaimValue, type TypedValue } from './claims';
import { isDay } from './day';

/** The value the act will carry, or the one sentence the analyst reads. */
export type ClaimEntry =
  | { readonly held: true; readonly value: AttributeValue }
  | { readonly held: false; readonly refusal: string };

// A plain decimal, and nothing else. A group separator, a space and an exponent are all refused.
const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

const EMPTY =
  'This key takes a value. An unknown value is the absence of the key, and not a blank.';

// A French machine prints and reads `43,5`, and `Number('43,5')` is `NaN`. A comma is refused
// here in words, so a decimal never reaches the record as a fault of the machine locale.
const COMMA = 'Write the number with a decimal point. A comma is not a decimal point here.';

const NOT_A_NUMBER =
  'This key takes a number. Write digits, and a decimal point where you need one.';

const NOT_A_DAY =
  'Write a day the calendar holds, as a year, a month and a day, with a hyphen between each part.';

const NOT_A_YES_OR_NO = 'This key takes a yes or a no.';

// The record holds a jsonb numeric, which takes far more. The browser is the tier that loses it.
const TOO_LARGE = 'The browser cannot hold a number of that many digits. Write it with fewer.';

const EMPTY_ELEMENT = 'A value of the list is blank. Remove the comma that has no value beside it.';

const NOT_A_NUMBER_LIST =
  'Each value of this list is a number. Write digits, and a decimal point where you need one.';

const COMMA_IN_ELEMENT =
  'A value of this list holds a comma, so the box cannot keep the values apart.' +
  ' This list takes no edit here.';

type ScalarControl = Exclude<ClaimControl, 'list'>;

type Reading =
  | { readonly control: ScalarControl }
  | Pick<Extract<ClaimValue, { control: 'list' }>, 'control' | 'element'>;

const held = (value: AttributeValue): ClaimEntry => ({ held: true, value });

const refused = (refusal: string): ClaimEntry => ({ held: false, refusal });

// NOTHING HERE IS A RULE ON A VALUE. M11 leaves the free half of the model with none. What
// remains turns typed text into the JSON type its control emits, and a box must write a number
// or a string and cannot write both.

const readNumber = (typed: string): ClaimEntry => {
  if (typed.includes(',')) return refused(COMMA);
  if (!DECIMAL.test(typed)) return refused(NOT_A_NUMBER);
  const value = Number(typed);
  // 310 digits or more give Infinity, and the door then refuses it with `Invalid input`.
  if (!Number.isFinite(value)) return refused(TOO_LARGE);
  return held(value);
};

// The comma separates two values, and the space beside it is written back into the box and is
// never required in it. A trailing blank is the state of the box between two values, so it is
// dropped and never refused: a list must not flash red at each comma the analyst types.
const readList = (list: Extract<Reading, { control: 'list' }>, typed: string): ClaimEntry => {
  if (list.element === 'text with a comma') return refused(COMMA_IN_ELEMENT);
  const parts = typed.split(',').map((part) => part.trim());
  const written = parts.at(-1) === '' ? parts.slice(0, -1) : parts;
  if (written.length === 0 || written.includes('')) return refused(EMPTY_ELEMENT);
  if (list.element === 'text') return held(written);
  const numbers: number[] = [];
  for (const part of written) {
    const read = readNumber(part);
    if (!read.held || typeof read.value !== 'number') return refused(NOT_A_NUMBER_LIST);
    numbers.push(read.value);
  }
  return held(numbers);
};

const readDay = (typed: string): ClaimEntry => (isDay(typed) ? held(typed) : refused(NOT_A_DAY));

// A key that nobody declared has no kind, so the kind is read from the text (M11). A yes or a
// no, a plain decimal and a day of the calendar each name themselves. A text that names none of
// the three is text, and `2019-02-30` is one of them: no such day stands in the calendar.
export function controlOfTyped(typed: string, noteLength: number): ScalarControl {
  const trimmed = typed.trim();
  if (trimmed === 'yes' || trimmed === 'no') return 'boolean';
  if (DECIMAL.test(trimmed)) return 'number';
  if (isDay(trimmed)) return 'date';
  if (typed.length > noteLength || typed.includes('\n')) return 'note';
  return 'text';
}

/** One typed value, read in the control that emitted it. */
export function readEntry(reading: Reading, typed: TypedValue): ClaimEntry {
  if (reading.control === 'boolean')
    return typeof typed === 'boolean' ? held(typed) : refused(NOT_A_YES_OR_NO);
  if (typeof typed !== 'string') return refused(NOT_A_YES_OR_NO);

  const trimmed = reading.control === 'note' ? typed : typed.trim();
  if (trimmed.trim() === '') return refused(EMPTY);

  switch (reading.control) {
    case 'number':
      return readNumber(trimmed);
    case 'date':
      // A browser that draws no day control leaves plain text in the box, so this tier reads the
      // day itself. The record holds a day as a string, and one that is not read here lands
      // unread.
      return readDay(trimmed);
    case 'list':
      return readList(reading, trimmed);
    case 'text':
    case 'note':
      return held(trimmed);
  }
}
