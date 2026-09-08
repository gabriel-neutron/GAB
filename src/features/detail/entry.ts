/** Typed text back into an attribute value, in the control it was typed into. The database is
 * the second tier and refuses what this misses; this tier gives a sentence before a round trip. */

import type { AttributeValue } from '@/shared/read/model';

import { DATE_ONLY, type ClaimControl, type TypedValue } from './claims';

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
  'Write a day of the calendar as a year, a month and a day, with a hyphen between each part.';

const NOT_A_YES_OR_NO = 'This key takes a yes or a no.';

const EMPTY_ELEMENT = 'A value of the list is blank. Remove the comma that has no value beside it.';

const held = (value: AttributeValue): ClaimEntry => ({ held: true, value });

const refused = (refusal: string): ClaimEntry => ({ held: false, refusal });

// NOTHING HERE IS A RULE ON A VALUE. M11 leaves the free half of the model with none. What
// remains turns typed text into the JSON type its control emits, and a box must write a number
// or a string and cannot write both.

const readNumber = (typed: string): ClaimEntry => {
  if (typed.includes(',')) return refused(COMMA);
  if (!DECIMAL.test(typed)) return refused(NOT_A_NUMBER);
  return held(Number(typed));
};

// The comma separates two values, and the space beside it is written back into the box and is
// never required in it. A trailing blank is the state of the box between two values, so it is
// dropped and never refused: a list must not flash red at each comma the analyst types.
const readList = (typed: string): ClaimEntry => {
  const parts = typed.split(',').map((part) => part.trim());
  const written = parts.at(-1) === '' ? parts.slice(0, -1) : parts;
  if (written.length === 0 || written.includes('')) return refused(EMPTY_ELEMENT);
  return held(written);
};

const LAST_DAY = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const leapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

// The shape alone admits `2019-99-99`, so each part is counted against the calendar.
const readDay = (typed: string): ClaimEntry => {
  if (!DATE_ONLY.test(typed)) return refused(NOT_A_DAY);
  const year = Number(typed.slice(0, 4));
  const month = Number(typed.slice(5, 7));
  const day = Number(typed.slice(8, 10));
  const last = month === 2 && leapYear(year) ? 29 : LAST_DAY[month - 1];
  if (last === undefined || day < 1 || day > last) return refused(NOT_A_DAY);
  return held(typed);
};

/** One typed value, read in the control that emitted it. */
export function readEntry(control: ClaimControl, typed: TypedValue): ClaimEntry {
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
    case 'list':
      return readList(trimmed);
    case 'text':
    case 'note':
      return held(trimmed);
  }
}
