import { createFileRoute, stripSearchParams, useRouter } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { readDecided } from '@/features/review/decided';
import { sendVerdict, type DecisionState } from '@/features/review/decision';
import { ReviewPage, type ReviewAct } from '@/features/review/review-page';
import { ReviewSurface, type ReviewView } from '@/features/review/review-surface';
import { readQueue, type SortKey, type Verdicts } from '@/features/review/queue';
import { subjectsNamed } from '@/features/review/subjects-named';
import { beginVerdict, decisionAfterMove, settleVerdict } from '@/features/review/verdict-flow';
import { patchSort, readSort } from '@/features/review/workspace';
import { loadCorpus, refreshCorpus } from '@/shared/read/corpus';
import { loadDecidedActs } from '@/shared/read/decided-acts';
import { loadEntityTypes } from '@/shared/read/vocabulary';
import { useScreenQuery } from '@/shared/screen-query';

export interface ReviewSearch {
  /** What is under examination. An empty string opens the queue at its first subject. */
  readonly subject: string;
  readonly view: ReviewView;
}

const IDLE: DecisionState = { step: 'idle' };

export const Route = createFileRoute('/review')({
  // The address comes from outside, so it is validated before its first use. A stale identifier
  // opens the queue at its first subject, and it never takes the surface off the screen.
  validateSearch: (search: Record<string, unknown>): ReviewSearch => {
    const subject = search['subject'];
    return {
      subject: typeof subject === 'string' ? subject : '',
      view: search['view'] === 'decided' ? 'decided' : 'queue',
    };
  },

  search: { middlewares: [stripSearchParams({ subject: '', view: 'queue' })] },

  // The router draws no component until these answers arrive, so the queue and the history below
  // are read from answers that are already held. The view is no dependency of the loader: a
  // reload keyed on it draws the pending screen, and that screen would end the pass.
  loader: async () => {
    const [corpus, decided, types] = await Promise.all([
      loadCorpus(),
      loadDecidedActs(),
      loadEntityTypes(),
    ]);
    return { corpus, decided, types };
  },

  component: ReviewRoute,
  head: () => ({ meta: [{ title: 'Review · Gabriel' }] }),
});

function ReviewRoute() {
  const { subject, view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { corpus, decided, types } = Route.useLoaderData();
  const router = useRouter();

  const [sort, setSort] = useState<SortKey>(readSort);

  // The verdicts of one pass. A promotion and a rejection also stand in the record, and the act
  // then leaves the queue on the next read; a hold stands here alone and a reload loses it.
  const [verdicts, setVerdicts] = useState<Verdicts>({});

  const [decision, setDecision] = useState<DecisionState>(IDLE);

  // Without this memory every render of this route walks the whole corpus again.
  const queued = useMemo(() => readQueue(corpus, types), [corpus, types]);
  const query = useScreenQuery({
    named: queued,
    choose: (subjectId) => {
      onAct({ kind: 'select', subjectId });
    },
  });
  const subjects = useMemo(() => subjectsNamed(queued, query), [queued, query]);
  const history = useMemo(() => readDecided(corpus, decided), [corpus, decided]);

  const forgetTheSentence = (): void => {
    setDecision(decisionAfterMove(decision));
  };

  const onAct = (act: ReviewAct): void => {
    switch (act.kind) {
      case 'select':
        forgetTheSentence();
        void navigate({ search: (held) => ({ ...held, subject: act.subjectId }), replace: true });
        return;
      case 'sort':
        setSort(act.sort);
        patchSort(act.sort);
        return;
      case 'decide': {
        // A decision is an event handler and never an effect.
        const deciding = beginVerdict(decision, act);
        if (deciding === null) return;
        setDecision(deciding);
        void sendVerdict(act.changeId, act.verdict).then(async (answer) => {
          const { held, readAgain } = settleVerdict(answer, act);
          setDecision(answer);
          if (held !== null) setVerdicts((all) => ({ ...all, [act.changeId]: held }));
          if (readAgain) await refreshCorpus(() => router.invalidate());
        });
        return;
      }
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
    <ReviewSurface
      view={view}
      onView={(next) => {
        void navigate({ search: (held) => ({ ...held, view: next }), replace: true });
      }}
      decided={history}
      queue={
        <ReviewPage
          queue={{ subjects, verdicts }}
          examination={{ subjectId: subject === '' ? null : subject, sort }}
          decision={decision}
          onAct={onAct}
        />
      }
    />
  );
}
