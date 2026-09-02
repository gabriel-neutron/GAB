import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { ReviewPage, type ReviewAct } from '@/features/review/review-page';
import { readQueue, type SortKey, type Verdicts } from '@/features/review/queue';
import { patchSort, readSort } from '@/features/review/workspace';
import { loadCorpus } from '@/shared/read/corpus';

export interface ReviewSearch {
  /** What is under examination. An empty string opens the queue at its first subject. */
  readonly subject: string;
}

/** The confidence threshold is an operational parameter, and never a constant of the source. No
 * path carries one to the browser today, so the screen holds none and says so on each act. */
const THRESHOLD = null;

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

  const [sort, setSort] = useState<SortKey>(readSort);

  // The verdicts of one pass, and they die with it. The record holds no state between a proposal
  // and a decision, and this route invents none.
  const [verdicts, setVerdicts] = useState<Verdicts>({});

  // Without this memory every render of this route walks the whole corpus again.
  const subjects = useMemo(() => readQueue(corpus, THRESHOLD), [corpus]);

  const onAct = (act: ReviewAct): void => {
    switch (act.kind) {
      case 'select':
        void navigate({ search: { subject: act.subjectId }, replace: true });
        return;
      case 'sort':
        setSort(act.sort);
        patchSort(act.sort);
        return;
      case 'decide':
        setVerdicts((held) => ({
          ...held,
          [act.changeId]: { verdict: act.verdict, reason: act.reason },
        }));
        return;
      case 'undo':
        // Rebuilt and not destructured: a discarded binding is an unused variable, and this
        // repository permits no suppression of one.
        setVerdicts((held) =>
          Object.fromEntries(Object.entries(held).filter(([key]) => key !== act.changeId)),
        );
        return;
    }
  };

  return (
    <ReviewPage
      queue={{ subjects, verdicts }}
      examination={{ subjectId: subject === '' ? null : subject, sort }}
      onAct={onAct}
    />
  );
}
