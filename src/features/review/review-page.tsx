/**
 * **PROTOTYPE — throwaway.** The full page at `/review`, where a decision is made.
 *
 * The data, the pass and the persistence live here; the three variations below hold nothing but
 * a layout. That is deliberate — if each variation carried its own behaviour the operator would
 * be comparing three programs and not three designs.
 *
 * It holds what waits for a decision, and nothing else. What has been decided is on
 * `/review/decided`, which is rarely opened.
 */

import { useState } from 'react';

import { readWorkspace, writeWorkspace } from '@/shared/storage';

import {
  isSortKey,
  pendingSubjects,
  type DecisionMap,
  type LocalVerdict,
  type SortKey,
} from './prototype-model';
import type { LayoutProps } from './prototype-pass';
import { ReviewInspector } from './prototype-inspector';

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

  const props: LayoutProps = {
    subjects: pendingSubjects(),
    sort,
    onSort: (next) => {
      setSort(next);
      writeWorkspace('review', { sort: next });
    },
    decisions,
    onDecide: (id, verdict: LocalVerdict, reason) => {
      setDecisions((current) => ({ ...current, [id]: { verdict, reason } }));
    },
    onUndo: (id) => {
      // Rebuilt rather than destructured: the repository permits no suppression, and a
      // discarded binding is an unused variable however it is named.
      setDecisions((current) =>
        Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)),
      );
    },
    selectedId: subjectId,
    onSelect,
  };

  return <ReviewInspector {...props} />;
}
