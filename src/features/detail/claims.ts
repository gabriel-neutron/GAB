/** The control of a claim comes from the kind the database declares for its key. A value never
 * states its own type: a seven-digit IMO number is an identifier and not a quantity. */

import type {
  AttributeDeclaration,
  AttributeKind,
  AttributeValue,
  Attributes,
  DocId,
  Vocabulary,
} from '@/shared/read/model';

export type ClaimControl = 'boolean' | 'number' | 'date' | 'text' | 'note' | 'list';

/** A derivation holds no class string. The presentation maps these four names to widths. */
export type ClaimWidth = 'short' | 'date' | 'medium' | 'line';

export type ClaimValue =
  | { readonly control: 'boolean'; readonly checked: boolean; readonly text: string }
  | { readonly control: 'number' | 'date' | 'text' | 'note'; readonly text: string }
  | { readonly control: 'list'; readonly text: string; readonly count: number };

/** What a control emits: a checkbox gives a yes or a no, and every other control gives text. */
export type TypedValue = string | boolean;

/** Whether the analyst may write this key here, and the sentence that says why not. */
export type ClaimEdit =
  | { readonly editable: true; readonly declaration: AttributeDeclaration }
  | { readonly editable: false; readonly reason: string };

export interface ClaimRow {
  readonly key: string;
  readonly label: string;
  readonly value: ClaimValue;
  readonly width: ClaimWidth;
  readonly edit: ClaimEdit;
  /** M8: every claim carries the documents it comes from. No control hides them. */
  readonly sources: readonly DocId[];
}

/** The separator of a list, in the box and back out of it. */
export const LIST_SEPARATOR = ', ';

const NOT_DECLARED = 'The vocabulary declares no such key, and it takes no value here.';
const RETIRED = 'This key is retired. It keeps its history, and it takes no new value.';

/** The seven declared kinds, on the six controls a claim is drawn with. */
const CONTROL_OF_KIND: Readonly<Record<AttributeKind, ClaimControl>> = {
  quantity: 'number',
  identifier: 'text',
  text: 'text',
  note: 'note',
  date: 'date',
  boolean: 'boolean',
  list: 'list',
};

/** The shape of a day. A declared date is read against it, and a text of this shape stands in
 * for a date where no key is declared. */
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

/** The stored value, drawn in the control the declared kind names. The shape of the value is
 * read only where the key is undeclared, which is a key nothing can write anyway. */
function drawnAs(control: ClaimControl, value: AttributeValue): ClaimValue {
  if (control === 'boolean') {
    const checked = value === true;
    return { control, checked, text: checked ? 'yes' : 'no' };
  }
  if (control === 'list') {
    const parts = Array.isArray(value) ? value.map(String) : [String(value)];
    return { control, text: parts.join(LIST_SEPARATOR), count: parts.length };
  }
  return { control, text: String(value) };
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

// The name of a declared key is what `attribute_key.label` states, and this stands in only for a
// key the vocabulary does not declare — a key nothing can write, and one that carries no name of
// its own to print.
function undeclaredLabel(key: string): string {
  const words = key.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function readClaims(attrs: Attributes, vocabulary: Vocabulary): readonly ClaimRow[] {
  const declared = new Map(vocabulary.map((entry) => [entry.key, entry]));

  return (
    Object.entries(attrs)
      // No order arrives from the model. The alphabet stands in.
      .sort(([a], [b]) => byCodePoint(a, b))
      .map(([key, attribute]) => {
        const declaration = declared.get(key);
        const value =
          declaration === undefined
            ? shapeOf(attribute.v)
            : drawnAs(CONTROL_OF_KIND[declaration.kind], attribute.v);
        const edit: ClaimEdit =
          declaration === undefined
            ? { editable: false, reason: NOT_DECLARED }
            : declaration.retired
              ? { editable: false, reason: RETIRED }
              : { editable: true, declaration };
        return {
          key,
          label: declaration === undefined ? undeclaredLabel(key) : declaration.label,
          value,
          width: widthOf(value),
          edit,
          sources: attribute.src,
        };
      })
  );
}
