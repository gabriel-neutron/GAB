import { createFileRoute, stripSearchParams, useRouter } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import type { DecisionState } from '@/features/review/decision-bar';
import { readDecided } from '@/features/review/decided';
import { afterDecision, queueUnits } from '@/features/review/held-pages';
import { ReviewSurface, type ReviewView } from '@/features/review/review-surface';
import {
  filterIsOn,
  patchReviewWorkspace,
  readReviewWorkspace,
} from '@/features/review/review-workspace';
import type { UnitPage } from '@/features/review/unit-page';
import { unitWords } from '@/features/review/unit-words';
import { readUnits } from '@/features/review/units';
import { UnitsPage, type QueueView, type ReviewAct } from '@/features/review/units-page';
import { loadCorpus } from '@/shared/read/corpus';
import { loadDecidedActs } from '@/shared/read/decided-acts';
import { loadEntityTypes, loadRelationTypes } from '@/shared/read/vocabulary';
import { sendDecision } from '@/shared/write/door';

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

  // The queue reads one page of units, with the filter and from the place that the workspace
  // holds, so a reload keeps both. The history reads the whole corpus, so it is read only when
  // the history is open.
  loaderDeps: ({ search }) => ({ view: search.view }),
  loader: async ({ deps }) => {
    const { filter, from } = readReviewWorkspace();
    const [first, relationTypes, entityTypes] = await Promise.all([
      readUnits(from, filter),
      loadRelationTypes(),
      loadEntityTypes(),
    ]);
    if (deps.view !== 'decided') return { first, filter, relationTypes, entityTypes, history: [] };
    const [corpus, decided] = await Promise.all([loadCorpus(), loadDecidedActs()]);
    return { first, filter, relationTypes, entityTypes, history: readDecided(corpus, decided) };
  },

  component: ReviewRoute,
  head: () => ({ meta: [{ title: 'Review · Gabriel' }] }),
});

/** The pages read from the first page that the loader gave, the counts of the last read, and
 * whether a read of the next page runs now. A page read again after a decision replaces the page
 * that it was read for. */
interface HeldPages {
  readonly from: UnitPage | null;
  readonly pages: readonly UnitPage[];
  readonly total: number;
  readonly matched: number;
  readonly reading: boolean;
}

const startOf = (first: UnitPage | null): HeldPages => ({
  from: first,
  pages: first === null ? [] : [first],
  total: first?.total ?? 0,
  matched: first?.matched ?? 0,
  reading: false,
});

const NO_CHOICES = { groups: [], documents: [] };

function ReviewRoute() {
  const { unit, view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { first, filter, relationTypes, entityTypes, history } = Route.useLoaderData();
  const router = useRouter();

  // The pages and the decision die with the view: a reload reads the first page again.
  const [held, setHeld] = useState<HeldPages>(startOf(null));
  const [decision, setDecision] = useState<DecisionState>({ step: 'idle' });

  const words = useMemo(() => unitWords(relationTypes, entityTypes), [relationTypes, entityTypes]);

  // The held pages follow the first page that they were read after. When the loader reads the
  // first page again, they no longer follow it, so no unit shows twice.
  const firstPage = first.state === 'held' ? first.page : null;
  const now = firstPage !== null && held.from === firstPage ? held : startOf(firstPage);
  const last = now.pages.at(-1)?.next ?? null;

  const queue: QueueView =
    first.state === 'private'
      ? first
      : {
          state: 'held',
          queue: {
            units: queueUnits(now.pages),
            total: now.total,
            matched: now.matched,
            before: now.pages[0]?.before ?? 0,
            filtered: filterIsOn(filter),
            more: now.reading ? 'reading' : last === null ? 'none' : 'ready',
          },
          filter,
          choices: now.pages.at(-1)?.choices ?? NO_CHOICES,
          decision,
        };

  // The place in the queue is the key that the page of the selected unit starts after, so a
  // reload reads that page first.
  const select = (unitId: string): void => {
    const page = now.pages.find((held) => held.units.some((one) => one.id === unitId));
    if (page !== undefined) patchReviewWorkspace({ from: page.after });
    void navigate({ search: (search) => ({ ...search, unit: unitId }), replace: true });
  };

  // A new filter or a read from the first unit asks the loader for its first page again.
  const readFrom = (patch: Parameters<typeof patchReviewWorkspace>[0]): void => {
    patchReviewWorkspace({ ...patch, from: null });
    void router.invalidate();
  };

  // Only the page that held the unit is read again, so the rest of the queue keeps its place.
  const readAgain = async (decided: string, mode: 'unit' | 'relation'): Promise<void> => {
    const after = afterDecision(now.pages, decided, mode);
    select(after.next);
    const read = await readUnits(after.after, filter);
    if (read.state !== 'held') return;
    setHeld((before) =>
      before.from === now.from
        ? {
            ...before,
            pages: before.pages.map((page, index) => (index === after.page ? read.page : page)),
            total: read.page.total,
            matched: read.page.matched,
          }
        : before,
    );
  };

  const onAct = (act: ReviewAct): void => {
    switch (act.kind) {
      case 'select':
        select(act.unitId);
        return;
      case 'start':
        readFrom({});
        return;
      case 'filter':
        void navigate({ search: (search) => ({ ...search, unit: '' }), replace: true });
        readFrom({ filter: act.filter });
        return;
      case 'more':
        if (now.reading || last === null) return;
        setHeld({ ...now, reading: true });
        void readUnits(last, filter).then((read) => {
          setHeld((before) =>
            before.from === now.from
              ? {
                  ...before,
                  pages: read.state === 'held' ? [...before.pages, read.page] : before.pages,
                  total: read.state === 'held' ? read.page.total : before.total,
                  matched: read.state === 'held' ? read.page.matched : before.matched,
                  reading: false,
                }
              : before,
          );
        });
        return;
      case 'decide': {
        const { unitId, decision: asked } = act;
        // The held pages are kept as they stand, so the read after the decision replaces one.
        setHeld(now);
        setDecision({ step: 'working', unitId });
        void sendDecision(asked).then(async (result) => {
          setDecision({ ...result, unitId });
          if (result.step === 'done')
            await readAgain(unitId, asked.op === 'reject_relation' ? 'relation' : 'unit');
        });
        return;
      }
    }
  };

  return (
    <ReviewSurface
      view={view}
      onView={(next) => {
        void navigate({ search: (search) => ({ ...search, view: next }), replace: true });
      }}
      decided={history}
      queue={<UnitsPage view={queue} selectedId={unit} words={words} onAct={onAct} />}
    />
  );
}
