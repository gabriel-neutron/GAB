/**
 * An attribute set that declares nothing, read as rows a surface can draw.
 *
 * **This whole file is a guess, and it is the only place that holds it.** The model
 * carries no type, no unit, no group and no order for an attribute, so this file takes the
 * control from the shape of the value, the group from the name of the key, and the order from
 * the alphabet. Each rule is named as a guess where it stands.
 *
 * **It reports to the tracker and it dies there.** The day an attribute arrives with its type,
 * its
 * unit and its group, every rule below is deleted and nothing else changes: the file is one
 * function over one argument, and it imports no read module.
 *
 * It returns the rows in group order, and the alphabet inside each group. The caller inserts
 * the headings, because a flat list of rows is what lets the record hold one `.map`.
 */

import type { AttributeValue, Attributes, DocId } from '@/shared/fixtures/types';

/** The control the value asks for. A list is joined into the one box. */
export type ClaimControl = 'boolean' | 'number' | 'date' | 'text' | 'note' | 'list';

/**
 * The width of the cell, as a name and never as a class.
 *
 * Four widths: 17 rem, 20 rem, 26 rem and the whole line. A derivation holds no
 * class string, so the presentation maps these four names to the four widths.
 */
export type ClaimWidth = 'short' | 'date' | 'medium' | 'line';

/**
 * The value, with the control it asks for. A closed set: a caller cannot build a checkbox with
 * no state, and cannot build a list with no count.
 */
export type ClaimValue =
  | { readonly control: 'boolean'; readonly checked: boolean; readonly text: string }
  | { readonly control: 'number' | 'date' | 'text' | 'note'; readonly text: string }
  | { readonly control: 'list'; readonly text: string; readonly count: number };

export interface ClaimRow {
  /** The attribute key. It is the domain identifier of the row, and the key of the list. */
  readonly key: string;
  /** The key, humanised. The model carries no label either. */
  readonly label: string;
  readonly value: ClaimValue;
  readonly width: ClaimWidth;
  /** M8: every claim carries the documents it comes from. No control hides them. */
  readonly sources: readonly DocId[];
}

/** A text of exactly this shape is read as a date. A guess, and the tracker carries it. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Longer than this, or with a line break, and the text is read as a note. A guess. */
const NOTE_LENGTH = 48;

/** A yes-or-no, or a text up to this length, takes the 17 rem cell. */
const SHORT_LENGTH = 12;

/** A text up to this length takes the 26 rem cell. Longer takes the whole line. */
const MEDIUM_LENGTH = 34;

/** The control, from the shape of the value. The first guess. */
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

/** The four widths. The value decides, and the pane does not. */
function widthOf(value: ClaimValue): ClaimWidth {
  if (value.control === 'boolean') return 'short';
  if (value.control === 'date') return 'date';
  if (value.text.length <= SHORT_LENGTH) return 'short';
  if (value.text.length <= MEDIUM_LENGTH) return 'medium';
  return 'line';
}

/**
 * The order of two keys, by code point.
 *
 * **The defect this replaces:** the keys were sorted with `a.localeCompare(b)` and no locale.
 * The collation of `_` and of a digit is decided by ICU and by the locale of the machine, and
 * this order decides the order `./dossier` hands out the badge numbers. A second machine
 * therefore renumbered every badge, and the order of the rail and a `?src=` deep link both
 * follow those numbers. **Do not restore `localeCompare` with no locale.** A code point compare
 * needs no ICU at all and gives one order on every machine.
 */
function byCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** The key, humanised. Sentence case, because the surface is sentence case everywhere. */
function labelOf(key: string): string {
  const words = key.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The claims of one entity, in one flat list.
 *
 * **The order is the alphabet of the key, and nothing else.** Two lists put a claim in a group and
 * ordered those groups, and both are gone. The headings they drew were removed, because their
 * names were invented in this file and no data supplies them. **The tracker owns any real group
 * and any
 * real order**, and this file now guesses at neither.
 */
export function readClaims(attrs: Attributes): readonly ClaimRow[] {
  return (
    Object.entries(attrs)
      // The third guess: no order arrives, so the alphabet is the order.
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
