/** The model gives no type, unit or group. These rules stand in until that shape is decided. */

import type { AttributeValue, Attributes, DocId } from '@/shared/fixtures/types';

export type ClaimControl = 'boolean' | 'number' | 'date' | 'text' | 'note' | 'list';

/** A derivation holds no class string. The presentation maps these four names to widths. */
export type ClaimWidth = 'short' | 'date' | 'medium' | 'line';

export type ClaimValue =
  | { readonly control: 'boolean'; readonly checked: boolean; readonly text: string }
  | { readonly control: 'number' | 'date' | 'text' | 'note'; readonly text: string }
  | { readonly control: 'list'; readonly text: string; readonly count: number };

export interface ClaimRow {
  readonly key: string;
  readonly label: string;
  readonly value: ClaimValue;
  readonly width: ClaimWidth;
  /** M8: every claim carries the documents it comes from. No control hides them. */
  readonly sources: readonly DocId[];
}

/** A text of this exact shape is read as a date. It stands in until the model gives a type. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

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
  return { control: 'list', text: value.join(', '), count: value.length };
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
        return {
          key,
          label: labelOf(key),
          value,
          width: widthOf(value),
          sources: attribute.src,
        };
      })
  );
}
