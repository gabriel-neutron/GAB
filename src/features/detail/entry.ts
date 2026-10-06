/** Typed text back into an attribute value, in the control it was typed into. The database is
 * the second tier and refuses what this misses; this tier gives a sentence before a round trip.
 * The reader of the kind stands here too, and it reads a value whose kind no key declares. */

import type { AttributeValue } from '@/shared/read/model';

import { NOTE_LENGTH, type ClaimControl, type ClaimValue, type TypedValue } from './claims';
import { isDay } from './day';

type Entry<Value> =
  | { readonly held: true; readonly value: Value }
  | { readonly held: false; readonly refusal: string };

/** The value the act will carry, or the one sentence the analyst reads. */
type ClaimEntry = Entry<AttributeValue>;

type ScalarEntry = Entry<string | number | boolean>;

// A plain decimal, and nothing else. A group separator, a space and an exponent are all refused.
const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

// External constraint: a double holds about 15 digits, so `Number` rounds a longer decimal.
// A decimal is exact when the double prints back as the typed text, less its trailing zeros.
const isExact = (decimal: string): boolean => {
  const bare = decimal.includes('.') ? decimal.replace(/\.?0+$/, '') : decimal;
  return String(Number(decimal)) === (bare === '-0' ? '0' : bare);
};

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

// External constraint: the record holds a jsonb numeric, which takes every digit. The browser
// holds a double, so it is the tier that would round the number.
const INEXACT = 'The browser cannot hold this number exactly. Write it with fewer digits.';

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

const held = <Value>(value: Value): Entry<Value> => ({ held: true, value });

const refused = (refusal: string): { readonly held: false; readonly refusal: string } => ({
  held: false,
  refusal,
});

// NOTHING HERE IS A RULE ON A VALUE. M11 leaves the free half of the model with none. What
// remains turns typed text into the JSON type its control emits, and a box must write a number
// or a string and cannot write both.

const readNumber = (typed: string): Entry<number> => {
  if (typed.includes(',')) return refused(COMMA);
  if (!DECIMAL.test(typed)) return refused(NOT_A_NUMBER);
  if (!isExact(typed)) return refused(INEXACT);
  return held(Number(typed));
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
    if (!read.held) return refused(NOT_A_NUMBER_LIST);
    numbers.push(read.value);
  }
  return held(numbers);
};

const readDay = (typed: string): ScalarEntry => (isDay(typed) ? held(typed) : refused(NOT_A_DAY));

const readScalar = (control: ScalarControl, typed: TypedValue): ScalarEntry => {
  if (control === 'boolean')
    return typeof typed === 'boolean' ? held(typed) : refused(NOT_A_YES_OR_NO);
  if (typeof typed !== 'string') return refused(NOT_A_YES_OR_NO);

  const trimmed = control === 'note' ? typed : typed.trim();
  if (trimmed.trim() === '') return refused(EMPTY);

  switch (control) {
    case 'number':
      return readNumber(trimmed);
    case 'date':
      // A browser that draws no day control leaves plain text in the box, so this tier reads the
      // day itself. The record holds a day as a string, and one that is not read here lands
      // unread.
      return readDay(trimmed);
    case 'text':
    case 'note':
      return held(trimmed);
  }
};

// Departure: no key declares a kind (M11), so the kind is read from the text. A yes or a no, an
// exact decimal and a day of the calendar name themselves. Any other text is text, as are
// `2019-02-30` and a 20-digit account number that a double would round.
const controlOfTyped = (typed: string): ScalarControl => {
  const trimmed = typed.trim();
  if (trimmed === 'yes' || trimmed === 'no') return 'boolean';
  if (DECIMAL.test(trimmed) && isExact(trimmed)) return 'number';
  if (isDay(trimmed)) return 'date';
  if (typed.length > NOTE_LENGTH || typed.includes('\n')) return 'note';
  return 'text';
};

/** One typed value, read in the control that emitted it. */
export function readEntry(reading: Reading, typed: TypedValue): ClaimEntry {
  if (reading.control !== 'list') return readScalar(reading.control, typed);
  if (typeof typed !== 'string') return refused(NOT_A_YES_OR_NO);
  const trimmed = typed.trim();
  if (trimmed === '') return refused(EMPTY);
  return readList(reading, trimmed);
}

/** A value whose kind no key declares: the kind read from the text, and the value in that kind.
 * The kind is never a list, so a comma is one text and never two values. */
export function readUndeclaredValue(typed: string): {
  readonly control: ScalarControl;
  readonly entry: ScalarEntry;
} {
  const control = controlOfTyped(typed);
  return {
    control,
    entry: readScalar(control, control === 'boolean' ? typed.trim() === 'yes' : typed),
  };
}
