/**
 * **PROTOTYPE — throwaway.** The behaviour the three variations share, and nothing about how
 * any of them looks.
 *
 * A variation owns its layout completely. What it must not own is the pass itself: which change
 * the keyboard acts on, how `J` and `K` step across subjects, and what a decision does next. If
 * that logic differed between variations the comparison would be worthless, because the operator
 * would be judging three behaviours and not three designs.
 */

import { useEffect, useState } from 'react';

import {
  sortSubjects,
  type Change,
  type DecisionMap,
  type LocalVerdict,
  type SortKey,
  type Subject,
} from './prototype-model';

export interface LayoutProps {
  readonly subjects: readonly Subject[];
  readonly sort: SortKey;
  readonly onSort: (next: SortKey) => void;
  readonly decisions: DecisionMap;
  readonly onDecide: (proposalId: string, verdict: LocalVerdict, reason: string) => void;
  /** Take a decision back. It reaches no database, and neither did the decision. */
  readonly onUndo: (proposalId: string) => void;
  readonly selectedId: string | null;
  readonly onSelect: (subjectId: string) => void;
}

export interface Pass {
  /** The subjects in the order the operator chose. */
  readonly ordered: readonly Subject[];
  /** The subject on the screen. */
  readonly current: Subject | null;
  /** The change the keyboard acts on, inside the current subject. */
  readonly focused: Change | null;
  readonly focus: (proposalId: string) => void;
  /** Move to a subject, and focus its first undecided change. */
  readonly select: (subjectId: string) => void;
  readonly decide: (change: Change, verdict: LocalVerdict, reason?: string) => void;
  /** Reverse a decision made on this pass. `Z` reverses the most recent. */
  readonly undo: (proposalId: string) => void;
  /** The change that is waiting on a written reason, or null. */
  readonly deferring: string | null;
  readonly setDeferring: (proposalId: string | null) => void;
  readonly verdictOf: (change: Change) => LocalVerdict | null;
  /** How many of a subject's changes are settled on this pass. */
  readonly settledIn: (subject: Subject) => number;
}

export function useReviewPass(props: LayoutProps): Pass {
  const { subjects, sort, decisions, onDecide, selectedId, onSelect } = props;
  const ordered = sortSubjects(subjects, sort);
  const current = ordered.find((s) => s.id === selectedId) ?? ordered[0] ?? null;

  // Which change the keyboard acts on. It is not the identity of what is examined, so ADR 0004
  // §7 keeps it out of the address — #33.
  const [focusId, setFocusId] = useState<string | null>(null);
  const [deferring, setDeferring] = useState<string | null>(null);
  /** The last change settled on this pass. `Z` reverses it. */
  const [lastDecided, setLastDecided] = useState<string | null>(null);

  const flat = ordered.flatMap((subject) => subject.changes.map((change) => ({ subject, change })));
  const at = flat.findIndex((entry) => entry.change.proposal.id === focusId);
  const focused = at === -1 ? (current?.changes[0] ?? null) : (flat[at]?.change ?? null);

  /**
   * Step to the next change that still waits.
   *
   * A decided change is skipped, because the second half of a pass was otherwise spent stepping
   * over rows that were already settled. The change under the cursor stays in the pool whatever
   * its state, so that the step is measured from where the analyst actually is — including
   * immediately after a decision, when React has not yet applied the new `decisions`.
   *
   * `includeDecided` re-opens the whole list, for a reader going back over the pass.
   */
  const move = (step: number, includeDecided = false): void => {
    const pool = includeDecided
      ? flat
      : flat.filter(
          (e) =>
            decisions[e.change.proposal.id] === undefined ||
            e.change.proposal.id === focused?.proposal.id,
        );
    const from = pool.findIndex((e) => e.change.proposal.id === focused?.proposal.id);
    const start = from === -1 ? pool.findIndex((e) => e.subject.id === current?.id) : from;
    const next = pool[Math.min(pool.length - 1, Math.max(0, start + step))];
    if (next === undefined) return;
    setFocusId(next.change.proposal.id);
    if (next.subject.id !== current?.id) onSelect(next.subject.id);
  };

  const decide = (change: Change, verdict: LocalVerdict, reason = ''): void => {
    if (verdict === 'deferred' && reason === '') {
      setDeferring(change.proposal.id);
      return;
    }
    onDecide(change.proposal.id, verdict, reason);
    setLastDecided(change.proposal.id);
    setDeferring(null);
    move(1);
  };

  const undo = (proposalId: string): void => {
    props.onUndo(proposalId);
    setFocusId(proposalId);
    if (proposalId === lastDecided) setLastDecided(null);
  };

  /**
   * Keep the focused change on the screen.
   *
   * `J` could otherwise move the cursor below the fold in either pane while `A` still acted on
   * it — the analyst promoted a change they could not see. Each layout marks its rows with
   * `data-change-id` and `data-subject-id`, so this works for all three without threading a ref
   * through every variation.
   */
  useEffect(() => {
    const id = focused?.proposal.id;
    if (id !== undefined) {
      document.querySelector(`[data-change-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
    }
    if (current !== null) {
      document
        .querySelector(`[data-subject-id="${current.id}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    }
  }, [focused?.proposal.id, current?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (focused === null) return;

      // **A held key must never decide twice.** Auto-repeat fires about thirty times a second,
      // and a promotion is the pivotal act of P1. Movement may repeat; a verdict may not.
      if (event.repeat && event.key !== 'j' && event.key !== 'k') return;

      switch (event.key) {
        case 'j':
        case 'J':
          move(1, event.shiftKey);
          break;
        case 'k':
        case 'K':
          move(-1, event.shiftKey);
          break;
        case 'a':
          decide(focused, 'accepted');
          break;
        case 'r':
          decide(focused, 'rejected');
          break;
        case 'd':
          setDeferring(focused.proposal.id);
          break;
        case 'z':
          if (lastDecided !== null) undo(lastDecided);
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  });

  return {
    ordered,
    current,
    focused,
    focus: setFocusId,
    select: (subjectId) => {
      onSelect(subjectId);
      const subject = ordered.find((s) => s.id === subjectId);
      const next =
        subject?.changes.find((c) => decisions[c.proposal.id] === undefined) ?? subject?.changes[0];
      setFocusId(next?.proposal.id ?? null);
    },
    decide,
    undo,
    deferring,
    setDeferring,
    verdictOf: (change) => decisions[change.proposal.id]?.verdict ?? null,
    settledIn: (subject) =>
      subject.changes.filter((c) => decisions[c.proposal.id] !== undefined).length,
  };
}
