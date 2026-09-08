/** The control of a claim comes from the shape of its value. Nothing declares what a key means
 * (M11), so a seven-digit IMO number is drawn as the text it is and never as a quantity. */

import type { AttributeValue, Attributes, DocId } from '@/shared/read/model';

export type ClaimControl = 'boolean' | 'number' | 'date' | 'text' | 'note' | 'list';

/** A derivation holds no class string. The presentation maps these four names to widths. */
export type ClaimWidth = 'short' | 'date' | 'medium' | 'line';

export type ClaimValue =
  | { readonly control: 'boolean'; readonly checked: boolean; readonly text: string }
  | { readonly control: 'number' | 'date' | 'text' | 'note'; readonly text: string }
  | { readonly control: 'list'; readonly text: string; readonly count: number };

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

/** The separator of a list, in the box and back out of it. */
export const LIST_SEPARATOR = ', ';

/** The shape of a day. A text of this shape is drawn and read as a day. */
export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Longer than this, or with a line break, and the text is read as a note. A stand-in value. */
const NOTE_LENGTH = 48;

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
    if (DATE_ONLY.test(value)) return { control: 'date', text: value };
    if (value.length > NOTE_LENGTH || value.includes('\n')) return { control: 'note', text: value };
    return { control: 'text', text: value };
  }
  // M7 leaves a flat list of scalars, and nothing else. It is joined into the one box.
  return { control: 'list', text: value.join(LIST_SEPARATOR), count: value.length };
}

/** What the analyst has typed, in the control it was typed into. The text is kept as it stands,
 * so a half-written number stays on the screen and the caret stays where it is. */
export function typedValue(control: ClaimControl, typed: TypedValue): ClaimValue {
  if (control === 'boolean') {
    const checked = typed === true;
    return { control, checked, text: checked ? 'yes' : 'no' };
  }
  const text = typeof typed === 'string' ? typed : String(typed);
  if (control === 'list') {
    return { control, text, count: text.split(',').length };
  }
  return { control, text };
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
