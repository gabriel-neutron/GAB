import { PROPOSERS } from '@gab/proposal/proposer';

import type { Proposer } from '@/shared/read/model';
import { holdsOnlyDeclaredKeys, readWorkspace, writeWorkspace } from '@/shared/storage';

import { FAULT_KINDS, LANES, type FaultKind, type Lane } from './unit-page';

const FEATURE = 'review';

/** The filters of the queue, and the list that it shows. A null filter, or an empty name, keeps
 * every unit of the list. The list is the doubts or the units that wait, and it is no filter that
 * a button clears. */
export interface QueueFilter {
  readonly lane: Lane;
  readonly group: string | null;
  readonly proposer: Proposer | null;
  readonly fault: FaultKind | null;
  readonly document: string | null;
  readonly name: string;
}

/** The filter of the queue, and the place in it: the key that the first page shown starts after,
 * or null for the first unit. */
export interface ReviewWorkspace {
  readonly filter: QueueFilter;
  readonly from: readonly string[] | null;
}

export const NO_FILTER: QueueFilter = {
  lane: 'doubt',
  group: null,
  proposer: null,
  fault: null,
  document: null,
  name: '',
};

const DEFAULT_REVIEW_WORKSPACE: ReviewWorkspace = { filter: NO_FILTER, from: null };

const PROPOSER_KEYS: readonly string[] = PROPOSERS;
const KINDS: readonly string[] = FAULT_KINDS;
const LANE_KEYS: readonly string[] = LANES;

// The compiler holds these lists closed: a key added to an interface and forgotten here fails the
// type check.
const WORKSPACE_KEYS: Readonly<Record<keyof ReviewWorkspace, true>> = { filter: true, from: true };
const FILTER_KEYS: Readonly<Record<keyof QueueFilter, true>> = {
  lane: true,
  group: true,
  proposer: true,
  fault: true,
  document: true,
  name: true,
};

const textOrNull = (value: unknown, allowed?: readonly string[]): boolean =>
  value === null ||
  (typeof value === 'string' && (allowed === undefined || allowed.includes(value)));

const isFilter = (value: unknown): value is QueueFilter => {
  if (!holdsOnlyDeclaredKeys(value, FILTER_KEYS)) return false;
  return (
    typeof value['lane'] === 'string' &&
    LANE_KEYS.includes(value['lane']) &&
    textOrNull(value['group']) &&
    textOrNull(value['proposer'], PROPOSER_KEYS) &&
    textOrNull(value['fault'], KINDS) &&
    textOrNull(value['document']) &&
    typeof value['name'] === 'string'
  );
};

// The sort key of the queue: the flag of no group, the height of the group, its subject, its
// identifier, the flag of no fault, the depth, the name, and the identifier of the unit. A key of
// another shape is the key of an older order, and the writer refuses it.
const NUMBER = /^\d{3}$/u;
const FLAG = /^[01]$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const SHAPE: readonly RegExp[] = [
  FLAG,
  NUMBER,
  /^/u,
  /^(|[0-9a-f-]{36})$/u,
  FLAG,
  NUMBER,
  /^/u,
  UUID,
];
const isKey = (value: unknown): value is readonly string[] =>
  Array.isArray(value) &&
  value.length === SHAPE.length &&
  value.every((part, at) => typeof part === 'string' && SHAPE[at]?.test(part) === true);

const isWorkspace = (value: unknown): value is ReviewWorkspace => {
  if (!holdsOnlyDeclaredKeys(value, WORKSPACE_KEYS)) return false;
  const from = value['from'];
  return isFilter(value['filter']) && (from === null || isKey(from));
};

// Departure: five exports, one job. They read and patch one stored record of the filter, the
// empty filter is its starting value, and one says whether a filter is on.

/** A filter is on when it can leave out a unit of the list. The list itself is not a filter. */
export const filterIsOn = (filter: QueueFilter): boolean =>
  filter.group !== null ||
  filter.proposer !== null ||
  filter.fault !== null ||
  filter.document !== null ||
  filter.name !== '';

export function readReviewWorkspace(): ReviewWorkspace {
  return readWorkspace(FEATURE, isWorkspace, DEFAULT_REVIEW_WORKSPACE);
}

// Every writer patches, and never replaces: two writers with partial records erase each other.
export function patchReviewWorkspace(patch: Partial<ReviewWorkspace>): ReviewWorkspace {
  const next: ReviewWorkspace = { ...readReviewWorkspace(), ...patch };
  writeWorkspace(FEATURE, next);
  return next;
}

/** Merges a part of the filter into the newest stored filter, and puts the place at the first
 * unit. It gives the filter that the queue now reads. */
export function patchQueueFilter(patch: Partial<QueueFilter>): QueueFilter {
  const filter: QueueFilter = { ...readReviewWorkspace().filter, ...patch };
  patchReviewWorkspace({ filter, from: null });
  return filter;
}
