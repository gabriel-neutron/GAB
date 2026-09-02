import { createFileRoute, stripSearchParams, useRouter } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { decisionSaid, sendVerdict, type DecisionState } from '@/features/review/decision';
import { ReviewPage, type ReviewAct } from '@/features/review/review-page';
import { readQueue, type SortKey, type Verdicts } from '@/features/review/queue';
import { patchSort, readSort } from '@/features/review/workspace';
import { loadCorpus, refreshCorpus } from '@/shared/read/corpus';

export interface ReviewSearch {
  /** What is under examination. An empty string opens the queue at its first subject. */
  readonly subject: string;
}

/** The confidence threshold is an operational parameter, and never a constant of the source. No
 * path carries one to the browser today, so the screen holds none and says so on each act. */
const THRESHOLD = null;

const IDLE: DecisionState = { step: 'idle' };

export const Route = createFileRoute('/review')({
  // The address comes from outside, so it is validated before its first use. A stale identifier
  // opens the queue at its first subject, and it never takes the surface off the screen.
  validateSearch: (search: Record<string, unknown>): ReviewSearch => {
    const subject = search['subject'];
    return { subject: typeof subject === 'string' ? subject : '' };
  },

  search: { middlewares: [stripSearchParams({ subject: '' })] },

  // The router draws no component until this answer arrives, so the queue below is read from a
  // corpus that is already held.
  loader: () => loadCorpus(),

  component: ReviewRoute,
  head: () => ({ meta: [{ title: 'Review · Gabriel' }] }),
});

function ReviewRoute() {
  const { subject } = Route.useSearch();
  const navigate = Route.useNavigate();
  const corpus = Route.useLoaderData();
  const router = useRouter();

  const [sort, setSort] = useState<SortKey>(readSort);

  // The verdicts of one pass. A promotion and a rejection also stand in the record, and the act
  // then leaves the queue on the next read; a hold stands here alone and a reload loses it.
  const [verdicts, setVerdicts] = useState<Verdicts>({});

  // Where the last verdict stands with the record, and what the surface says about it.
  const [decision, setDecision] = useState<DecisionState>(IDLE);

  // Without this memory every render of this route walks the whole corpus again.
  const subjects = useMemo(() => readQueue(corpus, THRESHOLD), [corpus]);

  // A refusal and a doubt outlive a move of the hand: the analyst must act on each one, and a
  // doubt names the one act that may stand in the record. A verdict on the way is never lost.
  const forgetTheSentence = (): void => {
    const said = decisionSaid(decision, null);
    if (!said.urgent && !said.busy) setDecision(IDLE);
  };

  const onAct = (act: ReviewAct): void => {
    switch (act.kind) {
      case 'select':
        forgetTheSentence();
        void navigate({ search: { subject: act.subjectId }, replace: true });
        return;
      case 'sort':
        setSort(act.sort);
        patchSort(act.sort);
        return;
      case 'decide':
        // A decision is an event handler and never an effect. The verdict is held only once the
        // record has taken it, so a refusal never draws as a decision that landed.
        if (decision.step === 'deciding') return;
        setDecision({ step: 'deciding', changeId: act.changeId, verdict: act.verdict });
        void sendVerdict(act.changeId, act.verdict).then(async (state) => {
          setDecision(state);
          if (state.step === 'decided') {
            setVerdicts((held) => ({
              ...held,
              [act.changeId]: { verdict: act.verdict, reason: act.reason },
            }));
            // A hold wrote nothing, and a read that follows one would only cost the analyst
            // the queue it holds.
            if (act.verdict === 'deferred') return;
          }
          // The record can hold a later state than this queue. The act landed, another window
          // decided it, or the record refused the act and it still waits. Each ends at one read.
          await refreshCorpus(() => router.invalidate());
        });
        return;
      case 'undo':
        // Rebuilt and not destructured: a discarded binding is an unused variable, and this
        // repository permits no suppression of one.
        setVerdicts((held) =>
          Object.fromEntries(Object.entries(held).filter(([key]) => key !== act.changeId)),
        );
        forgetTheSentence();
        return;
    }
  };

  return (
    <ReviewPage
      queue={{ subjects, verdicts }}
      examination={{ subjectId: subject === '' ? null : subject, sort }}
      decision={decision}
      onAct={onAct}
    />
  );
}
