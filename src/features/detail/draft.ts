/** The draft of the record: what is typed into each cell, what each cell draws, and what one
 * act would carry. The three run on one state, so they are one job and one file. */

import type { AttributeEdit } from '@gab/proposal/attribute-value';

import type { AttributeValue } from '@/shared/read/model';

import { typedValue, type ClaimValue, type ClaimWidth, type TypedValue } from './claims';
import type { RecordRow, SourceRef } from './dossier';
import { readEntry } from './entry';

/** One cell of the record as it stands: what is typed, and the refusal it stands at. */
export interface ClaimDraft {
  readonly value: ClaimValue;
  readonly refusal: string | null;
}

/** The claims the analyst has touched, by key. A key that is absent stands at its stored value. */
export type Drafts = ReadonlyMap<string, ClaimDraft>;

export interface RecordCell {
  readonly key: string;
  readonly label: string;
  readonly width: ClaimWidth;
  readonly value: ClaimValue;
  /** The sentence the last keystroke earned, and `null` while the value stands. */
  readonly refusal: string | null;
  readonly sources: readonly SourceRef[];
}

const NOTHING_CHANGED = 'Nothing is changed.';
const ONE_IS_REFUSED = 'One value is refused. Correct it, and then save.';

/** What one act would carry, or the sentence that says why no act can be composed. */
export type PendingEdit =
  | { readonly ready: true; readonly attrs: AttributeEdit; readonly count: number }
  | { readonly ready: false; readonly reason: string };

/** The cells of the record. `null` drafts give each claim at its stored value. */
export function recordCells(
  rows: readonly RecordRow[],
  drafts: Drafts | null,
): readonly RecordCell[] {
  return rows.map((row) => {
    const claim = row.claim;
    const draft = drafts?.get(claim.key);
    return {
      key: claim.key,
      label: claim.label,
      width: claim.width,
      value: draft?.value ?? claim.value,
      refusal: draft?.refusal ?? null,
      sources: row.sources,
    };
  });
}

/** One keystroke, into one cell. The text stands as it was typed, and the refusal stands beside
 * it: a control that rewrote what was typed would move the caret. */
export function typedInto(
  rows: readonly RecordRow[],
  drafts: Drafts,
  key: string,
  typed: TypedValue,
): Drafts {
  const claim = rows.find((candidate) => candidate.claim.key === key)?.claim;
  if (claim === undefined) return drafts;

  const value = typedValue(claim.value, typed);
  const next = new Map(drafts);
  // Departure: a text typed back to the stored text is the stored value, and no draft. A list
  // that takes no edit would otherwise hold its refusal after the analyst undid each keystroke.
  if (value.text === claim.value.text) {
    next.delete(key);
    return next;
  }
  const read = readEntry(claim.value, typed);
  next.set(key, { value, refusal: read.held ? null : read.refusal });
  return next;
}

/** The drafts that stand after an act was signed. A key the act carried now stands at its stored
 * value, so its draft goes. A key retyped while the act was in flight was never sent, and it
 * stands: the text on the screen is the one thing the analyst has. */
export function draftsAfterSave(current: Drafts, sent: Drafts, act: AttributeEdit): Drafts {
  const next = new Map(current);
  for (const key of Object.keys(act)) {
    if (next.get(key)?.value.text === sent.get(key)?.value.text) next.delete(key);
  }
  return next;
}

// The record holds a readable list, and the act carries one the door may write into.
const carried = (value: AttributeValue): AttributeEdit[string]['v'] =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? value
    : [...value];

/** The keys that stand at a new value, in the words the write door reads. */
export function pendingEdit(rows: readonly RecordRow[], drafts: Drafts): PendingEdit {
  const attrs: AttributeEdit = {};
  let count = 0;
  let refused = false;

  for (const row of rows) {
    const claim = row.claim;
    const draft = drafts.get(claim.key);
    if (draft === undefined) continue;
    if (draft.refusal !== null) {
      refused = true;
      continue;
    }
    if (draft.value.text === claim.value.text) continue;
    const read = readEntry(claim.value, entered(draft));
    if (!read.held) {
      refused = true;
      continue;
    }
    if (sameValue(read.value, storedValue(claim.value))) continue;
    attrs[claim.key] = { v: carried(read.value) };
    count += 1;
  }

  if (refused) return { ready: false, reason: ONE_IS_REFUSED };
  if (count === 0) return { ready: false, reason: NOTHING_CHANGED };
  return { ready: true, attrs, count };
}

const entered = (draft: ClaimDraft): TypedValue =>
  draft.value.control === 'boolean' ? draft.value.checked : draft.value.text;

// Departure: the stored text is read back without a trim, so a trim of a stored text is a change.
// A stored list joins its elements with a comma and a space, and no element holds a comma.
const storedValue = (stored: ClaimValue): AttributeValue => {
  switch (stored.control) {
    case 'boolean':
      return stored.checked;
    case 'number':
      return Number(stored.text);
    case 'list': {
      const elements = stored.text === '' ? [] : stored.text.split(', ');
      return stored.element === 'number' ? elements.map(Number) : elements;
    }
    case 'date':
    case 'text':
    case 'note':
      return stored.text;
  }
};

const sameValue = (a: AttributeValue, b: AttributeValue): boolean => {
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  return a.length === b.length && a.every((element, index) => element === b[index]);
};
