import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { readDecided } from '@/features/review/decided';
import { ReviewSurface, type ReviewView } from '@/features/review/review-surface';
import type { UnitListAct } from '@/features/review/unit-list';
import type { UnitPage } from '@/features/review/unit-page';
import { unitWords } from '@/features/review/unit-words';
import { readUnits } from '@/features/review/units';
import { UnitsPage, type QueueView } from '@/features/review/units-page';
import { loadCorpus } from '@/shared/read/corpus';
import { loadDecidedActs } from '@/shared/read/decided-acts';
import { loadEntityTypes, loadRelationTypes } from '@/shared/read/vocabulary';

export interface ReviewSearch {
  /** The unit under examination. An empty string opens the queue at its first unit. */
  readonly unit: string;
  readonly view: ReviewView;
}

export const Route = createFileRoute('/review')({
  // The address comes from outside, so it is validated before its first use. A stale identifier
  // opens the queue at its first unit, and it never takes the surface off the screen.
  validateSearch: (search: Record<string, unknown>): ReviewSearch => {
    const unit = search['unit'];
    return {
      unit: typeof unit === 'string' ? unit : '',
      view: search['view'] === 'decided' ? 'decided' : 'queue',
    };
  },

  search: { middlewares: [stripSearchParams({ unit: '', view: 'queue' })] },

  // The queue reads one page of units. The history reads the whole corpus, so it is read only
  // when the history is open.
  loaderDeps: ({ search }) => ({ view: search.view }),
  loader: async ({ deps }) => {
    const [first, relationTypes, entityTypes] = await Promise.all([
      readUnits(null),
      loadRelationTypes(),
      loadEntityTypes(),
    ]);
    if (deps.view !== 'decided') return { first, relationTypes, entityTypes, history: [] };
    const [corpus, decided] = await Promise.all([loadCorpus(), loadDecidedActs()]);
    return { first, relationTypes, entityTypes, history: readDecided(corpus, decided) };
  },

  component: ReviewRoute,
  head: () => ({ meta: [{ title: 'Review · Gabriel' }] }),
});

/** The pages read after the first one, and whether a read runs now. */
interface LaterPages {
  readonly pages: readonly UnitPage[];
  readonly reading: boolean;
}

const NONE: LaterPages = { pages: [], reading: false };

function ReviewRoute() {
  const { unit, view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { first, relationTypes, entityTypes, history } = Route.useLoaderData();

  // The pages after the first die with the view: a reload reads the first page again.
  const [later, setLater] = useState<LaterPages>(NONE);

  const words = useMemo(() => unitWords(relationTypes, entityTypes), [relationTypes, entityTypes]);

  const queue: QueueView =
    first.state === 'private'
      ? first
      : {
          state: 'held',
          queue: {
            units: [first.page, ...later.pages].flatMap((page) => page.units),
            total: first.page.total,
            more: later.reading
              ? 'reading'
              : (later.pages.at(-1) ?? first.page).next === null
                ? 'none'
                : 'ready',
          },
        };

  const onAct = (act: UnitListAct): void => {
    switch (act.kind) {
      case 'select':
        void navigate({ search: (held) => ({ ...held, unit: act.unitId }), replace: true });
        return;
      case 'more': {
        if (first.state === 'private' || later.reading) return;
        const after = (later.pages.at(-1) ?? first.page).next;
        if (after === null) return;
        setLater({ ...later, reading: true });
        void readUnits(after).then((read) => {
          setLater((held) => ({
            pages: read.state === 'held' ? [...held.pages, read.page] : held.pages,
            reading: false,
          }));
        });
        return;
      }
    }
  };

  return (
    <ReviewSurface
      view={view}
      onView={(next) => {
        void navigate({ search: (held) => ({ ...held, view: next }), replace: true });
      }}
      decided={history}
      queue={<UnitsPage view={queue} selectedId={unit} words={words} onAct={onAct} />}
    />
  );
}
