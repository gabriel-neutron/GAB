/**
 * **PROTOTYPE — throwaway.** The full page at `/review`, where a decision is actually made.
 *
 * It holds what waits for a decision, and nothing else. What has been decided is on
 * `/review/decided`, which is rarely opened.
 *
 * No state here is persisted. The threshold was a control and is now a constant in
 * `review-model.ts`, which decides nothing — #9 still owns the value.
 */

import { useState } from 'react';

import { pendingRows, type DecisionMap, type LocalVerdict } from './review-model';
import { VariantFocus } from './variant-focus';

export interface ReviewPageProps {
  /** The proposal being examined. Identity lives in the URL — ADR 0004 §7, #33. */
  readonly proposalId: string | null;
  readonly onSelect: (proposalId: string) => void;
}

export function ReviewPage({ proposalId, onSelect }: ReviewPageProps) {
  // In memory, and lost on reload. A deferral reason is neither identity nor workspace, so
  // ADR 0004 §7 gives it no shelf. #33.
  const [decisions, setDecisions] = useState<DecisionMap>({});

  const onDecide = (id: string, verdict: LocalVerdict, reason: string): void => {
    setDecisions((current) => ({ ...current, [id]: { verdict, reason } }));
  };

  return (
    <VariantFocus
      rows={pendingRows()}
      decisions={decisions}
      onDecide={onDecide}
      selectedId={proposalId}
      onSelect={onSelect}
    />
  );
}
