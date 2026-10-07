import { holdsOnlyDeclaredKeys, readWorkspace, writeWorkspace } from '@/shared/storage';

import { isSortKey, type SortKey } from './queue';

const FEATURE = 'review';

/** Every field the store may hold. A stored record carries a part of them: the route writes the
 * order alone, and the node pane writes the fold alone, so each reader states its own fallback. */
interface ReviewWorkspace {
  readonly sort: SortKey;
  readonly openRecord: boolean;
}

// The compiler holds this list closed: a key added to `ReviewWorkspace` and forgotten here fails
// the type check, so the guard below cannot fall behind the interface it guards.
const DECLARED_KEYS: Readonly<Record<keyof ReviewWorkspace, true>> = {
  sort: true,
  openRecord: true,
};

const isHeld = (value: unknown): value is Readonly<Record<string, unknown>> =>
  holdsOnlyDeclaredKeys(value, DECLARED_KEYS);

// Two writers share this key: the route holds the order, and the node pane holds the fold. Each
// one patches, because a writer that replaces the record erases the value of the other.
const patch = (part: Partial<ReviewWorkspace>): void => {
  writeWorkspace(FEATURE, { ...readWorkspace(FEATURE, isHeld, {}), ...part });
};

export function readSort(): SortKey {
  const held = readWorkspace(FEATURE, isHeld, {})['sort'];
  return isSortKey(held) ? held : 'oldest';
}

export function patchSort(sort: SortKey): void {
  patch({ sort });
}

/** The record stands open until the analyst folds it: a reader must tell fact from request with
 * nothing opened. */
export function readOpenRecord(): boolean {
  const held = readWorkspace(FEATURE, isHeld, {})['openRecord'];
  return typeof held === 'boolean' ? held : true;
}

export function patchOpenRecord(open: boolean): void {
  patch({ openRecord: open });
}
