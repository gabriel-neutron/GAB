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
  /** Why this key takes no value here. It is drawn in words, beside the control. */
  readonly note: string | null;
  readonly editable: boolean;
  readonly sources: readonly SourceRef[];
}

const NOTHING_CHANGED = 'Nothing is changed.';
const ONE_IS_REFUSED = 'One value is refused. Correct it, and then save.';

/** What one act would carry, or the sentence that says why no act can be composed. */
export type PendingEdit =
  | { readonly ready: true; readonly attrs: AttributeEdit; readonly count: number }
  | { readonly ready: false; readonly reason: string };

/**
 * The cells of the record. `null` drafts draw a record that is read through and never written,
 * and such a record states no sentence about editing, because it offers none. */
export function recordCells(
  rows: readonly RecordRow[],
  drafts: Drafts | null,
): readonly RecordCell[] {
  return rows.map((row) => {
    const claim = row.claim;
    const draft = drafts?.get(claim.key);
    const editable = drafts !== null && claim.edit.editable;
    return {
      key: claim.key,
      label: claim.label,
      width: claim.width,
      value: draft?.value ?? claim.value,
      refusal: draft?.refusal ?? null,
      note: drafts === null || claim.edit.editable ? null : claim.edit.reason,
      editable,
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
  if (!claim.edit.editable) return drafts;

  const read = readEntry(claim.edit.declaration, typed);
  const next = new Map(drafts);
  next.set(key, {
    value: typedValue(claim.value.control, typed),
    refusal: read.held ? null : read.refusal,
  });
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
    if (draft === undefined || !claim.edit.editable) continue;
    if (draft.refusal !== null) {
      refused = true;
      continue;
    }
    if (draft.value.text === claim.value.text) continue;
    const read = readEntry(claim.edit.declaration, entered(draft));
    if (!read.held) {
      refused = true;
      continue;
    }
    attrs[claim.key] = { v: carried(read.value) };
    count += 1;
  }

  if (refused) return { ready: false, reason: ONE_IS_REFUSED };
  if (count === 0) return { ready: false, reason: NOTHING_CHANGED };
  return { ready: true, attrs, count };
}

const entered = (draft: ClaimDraft): TypedValue =>
  draft.value.control === 'boolean' ? draft.value.checked : draft.value.text;
