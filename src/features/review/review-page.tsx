/**
 * **PROTOTYPE — throwaway.** The full page at `/review`, where a decision is made.
 *
 * It holds what waits for a decision, and nothing else. What has been decided is on
 * `/review/decided`, which is rarely opened.
 *
 * The sort order is workspace under ADR 0004 §7, which names it. No other state is persisted:
 * the identity of the subject is in the address, and every decision dies on reload.
 */

import { useState } from 'react';

import { readWorkspace, writeWorkspace } from '@/shared/storage';

import {
  isSortKey,
  pendingSubjects,
  type DecisionMap,
  type LocalVerdict,
  type SortKey,
} from './review-model';
import { VariantFocus } from './variant-focus';

interface Workspace {
  readonly sort: SortKey;
}

const isWorkspace = (value: unknown): value is Workspace =>
  typeof value === 'object' && value !== null && 'sort' in value && isSortKey(value.sort);

// Annotated, because `readWorkspace` infers its type from the guard *and* the fallback, and a
// bare object literal widens `sort` to `string`.
const WORKSPACE_FALLBACK: Workspace = { sort: 'confidence' };

export interface ReviewPageProps {
  /** The subject being examined. Identity lives in the URL — ADR 0004 §7, #33. */
  readonly subjectId: string | null;
  readonly onSelect: (subjectId: string) => void;
}

export function ReviewPage({ subjectId, onSelect }: ReviewPageProps) {
  const [sort, setSort] = useState<SortKey>(
    () => readWorkspace('review', isWorkspace, WORKSPACE_FALLBACK).sort,
  );
  // In memory, and lost on reload. A deferral reason is neither identity nor workspace, so
  // ADR 0004 §7 gives it no shelf. #33.
  const [decisions, setDecisions] = useState<DecisionMap>({});

  const onSort = (next: SortKey): void => {
    setSort(next);
    writeWorkspace('review', { sort: next });
  };

  const onDecide = (id: string, verdict: LocalVerdict, reason: string): void => {
    setDecisions((current) => ({ ...current, [id]: { verdict, reason } }));
  };

  return (
    <VariantFocus
      subjects={pendingSubjects()}
      sort={sort}
      onSort={onSort}
      decisions={decisions}
      onDecide={onDecide}
      selectedId={subjectId}
      onSelect={onSelect}
    />
  );
}
