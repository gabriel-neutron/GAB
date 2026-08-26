import { readWorkspace, writeWorkspace } from '@/shared/storage';

import { isSortKey, type SortKey } from './queue';

const FEATURE = 'review';

const isHeld = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Two writers share this key: the route holds the order, and the node pane holds the fold. Each
// one patches, because a writer that replaces the record erases the value of the other.
const patch = (part: Readonly<Record<string, unknown>>): void => {
  writeWorkspace(FEATURE, { ...readWorkspace(FEATURE, isHeld, {}), ...part });
};

export function readSort(): SortKey {
  const held = readWorkspace(FEATURE, isHeld, {})['sort'];
  return isSortKey(held) ? held : 'confidence';
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
