/** The control of a claim comes from the shape of its value, and never from the key. Nothing
 * declares what a key means (M11), so a number that was stored as text is drawn as text. */

import type { AttributeValue, Attributes, DocId } from '@/shared/read/model';

import { isDay } from './day';

export type ClaimControl = 'boolean' | 'number' | 'date' | 'text' | 'note' | 'list';

/** A derivation holds no class string. The presentation maps these four names to widths. */
export type ClaimWidth = 'short' | 'date' | 'medium' | 'line';

// Departure: the box holds one text, so a list states the kind its elements read back in. An
// element that holds the separator cannot come out of the box whole, so that list takes no edit.
type ListElement = 'number' | 'text' | 'text with a comma';

export type ClaimValue =
  | { readonly control: 'boolean'; readonly checked: boolean; readonly text: string }
  | { readonly control: 'number' | 'date' | 'text' | 'note'; readonly text: string }
  | { readonly control: 'list'; readonly text: string; readonly element: ListElement };

/** What a control emits: a checkbox gives a yes or a no, and every other control gives text. */
export type TypedValue = string | boolean;

export interface ClaimRow {
  readonly key: string;
  readonly label: string;
  readonly value: ClaimValue;
  readonly width: ClaimWidth;
  /** M8: every claim carries the documents it comes from. No control hides them. */
  readonly sources: readonly DocId[];
}

const LIST_SEPARATOR = ', ';

/** Longer than this, or with a line break, and the text is read as a note. A stand-in value.
 * The reader of a minted claim takes the same length, so what is typed draws as it was seen. */
export const NOTE_LENGTH = 48;

/** A yes-or-no, or a text up to this length, takes the 17 rem cell. */
const SHORT_LENGTH = 12;

/** A text up to this length takes the 26 rem cell. Longer takes the whole line. */
const MEDIUM_LENGTH = 34;

function shapeOf(value: AttributeValue): ClaimValue {
  if (typeof value === 'boolean') {
    return { control: 'boolean', checked: value, text: value ? 'yes' : 'no' };
  }
  if (typeof value === 'number') {
    return { control: 'number', text: String(value) };
  }
  if (typeof value === 'string') {
    // A day control empties itself for a text it cannot read, and the cell then reads as a
    // blank. An agent may write `2019-02-30`, so the calendar is counted before the control.
    if (isDay(value)) return { control: 'date', text: value };
    if (value.length > NOTE_LENGTH || value.includes('\n')) return { control: 'note', text: value };
    return { control: 'text', text: value };
  }
  // M7 leaves a flat list of scalars, and nothing else. It is joined into the one box.
  return { control: 'list', text: value.join(LIST_SEPARATOR), element: elementOf(value) };
}

function elementOf(list: readonly string[] | readonly number[]): ListElement {
  if (list.some((element) => typeof element === 'string' && element.includes(','))) {
    return 'text with a comma';
  }
  return list.length > 0 && list.every((element) => typeof element === 'number')
    ? 'number'
    : 'text';
}

/** Departure: the text is kept as it was typed, so a half-written number stays on the screen and
 * the caret stays where it is. A list keeps the element kind of the cell it was typed into. */
export function typedValue(start: ClaimValue, typed: TypedValue): ClaimValue {
  if (start.control === 'boolean') {
    const checked = typed === true;
    return { control: 'boolean', checked, text: checked ? 'yes' : 'no' };
  }
  const text = typeof typed === 'string' ? typed : String(typed);
  if (start.control === 'list') return { control: 'list', text, element: start.element };
  return { control: start.control, text };
}

function widthOf(value: ClaimValue): ClaimWidth {
  if (value.control === 'boolean') return 'short';
  if (value.control === 'date') return 'date';
  if (value.text.length <= SHORT_LENGTH) return 'short';
  if (value.text.length <= MEDIUM_LENGTH) return 'medium';
  return 'line';
}

/**
 * No `localeCompare` here. ICU collation varies by machine, and this order sets badge numbers.
 */
function byCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

// NOTHING NAMES A KEY BUT THE KEY. There is no label column and no vocabulary, so the printed
// name is the key with its underscores opened out and its first letter raised.
function labelOf(key: string): string {
  const words = key.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function readClaims(attrs: Attributes): readonly ClaimRow[] {
  return (
    Object.entries(attrs)
      // No order arrives from the model. The alphabet stands in.
      .sort(([a], [b]) => byCodePoint(a, b))
      .map(([key, attribute]) => {
        const value = shapeOf(attribute.v);
        return { key, label: labelOf(key), value, width: widthOf(value), sources: attribute.src };
      })
  );
}
