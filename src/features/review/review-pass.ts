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
} from './review-model';

export interface LayoutProps {
  readonly subjects: readonly Subject[];
  readonly sort: SortKey;
  readonly onSort: (next: SortKey) => void;
  readonly decisions: DecisionMap;
  readonly onDecide: (proposalId: string, verdict: LocalVerdict, reason: string) => void;
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

  const flat = ordered.flatMap((subject) => subject.changes.map((change) => ({ subject, change })));
  const at = flat.findIndex((entry) => entry.change.proposal.id === focusId);
  const focused = at === -1 ? (current?.changes[0] ?? null) : (flat[at]?.change ?? null);

  const move = (step: number): void => {
    const from = at === -1 ? flat.findIndex((e) => e.subject.id === current?.id) : at;
    const next = flat[Math.min(flat.length - 1, Math.max(0, from + step))];
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
    setDeferring(null);
    move(1);
  };

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
      switch (event.key) {
        case 'j':
          move(1);
          break;
        case 'k':
          move(-1);
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
    deferring,
    setDeferring,
    verdictOf: (change) => decisions[change.proposal.id]?.verdict ?? null,
    settledIn: (subject) =>
      subject.changes.filter((c) => decisions[c.proposal.id] !== undefined).length,
  };
}
