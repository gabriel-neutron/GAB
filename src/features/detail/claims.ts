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

export interface ClaimRow {
  readonly key: string;
  readonly label: string;
  readonly value: ClaimValue;
  readonly width: ClaimWidth;
  /** What the value is read against. A key the vocabulary does not describe carries an inferred
   * declaration, so every claim on the screen is written the same way. */
  readonly declaration: AttributeDeclaration;
  /** M8: every claim carries the documents it comes from. No control hides them. */
  readonly sources: readonly DocId[];
}

/** The separator of a list, in the box and back out of it. */
export const LIST_SEPARATOR = ', ';

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

/** The way back, for a key the vocabulary describes with nothing. `identifier` never appears
 * here: it is a rule about a value, and an inferred kind states no rule. */
const KIND_OF_CONTROL: Readonly<Record<ClaimControl, AttributeKind>> = {
  number: 'quantity',
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
 * read instead where the key is undeclared or retired, because nothing states a kind for it. */
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

// The name of a declared key is what `attribute_key.label` states, and this stands in where the
// vocabulary describes the key with nothing, so a key that arrived from an agent still prints.
function undeclaredLabel(key: string): string {
  const words = key.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The declaration an undeclared or retired key stands on: the kind its stored value already
 * has, and no format. The screen holds such a value to the kind it arrived with, because nothing
 * states a kind for it and a changed kind is a claim nobody made. */
const inferredDeclaration = (key: string, value: ClaimValue): AttributeDeclaration => ({
  key,
  kind: KIND_OF_CONTROL[value.control],
  label: undeclaredLabel(key),
  unit: null,
  pattern: null,
  retired: false,
});

export function readClaims(attrs: Attributes, vocabulary: Vocabulary): readonly ClaimRow[] {
  const declared = new Map(vocabulary.map((entry) => [entry.key, entry]));

  return (
    Object.entries(attrs)
      // No order arrives from the model. The alphabet stands in.
      .sort(([a], [b]) => byCodePoint(a, b))
      .map(([key, attribute]) => {
        const held = declared.get(key);
        // A retired word describes nothing, and the database accepts it like any undeclared key.
        const live = held !== undefined && !held.retired ? held : undefined;
        const value =
          live === undefined
            ? shapeOf(attribute.v)
            : drawnAs(CONTROL_OF_KIND[live.kind], attribute.v);
        return {
          key,
          label: held?.label ?? undeclaredLabel(key),
          value,
          width: widthOf(value),
          declaration: live ?? inferredDeclaration(key, value),
          sources: attribute.src,
        };
      })
  );
}
