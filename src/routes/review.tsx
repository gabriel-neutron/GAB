import { createFileRoute, stripSearchParams, useRouter } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import type { DecisionState } from '@/features/review/decision-bar';
import { readDecided } from '@/features/review/decided';
import type { GroupActionState, GroupView } from '@/features/review/group-panel';
import { readGroupUnits, readGroups } from '@/features/review/groups';
import { GroupsPage, type GroupsAct } from '@/features/review/groups-page';
import { afterDecision, queueUnits } from '@/features/review/held-pages';
import { ReviewSurface, type ReviewView } from '@/features/review/review-surface';
import type { UnitPage } from '@/features/review/unit-page';
import { unitWords } from '@/features/review/unit-words';
import { sendGroupAction } from '@/features/review/send-group-action';
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
  /** The group open on the page of the groups. An empty string opens none. */
  readonly group: string;
}

export const Route = createFileRoute('/review')({
  // The address comes from outside, so it is validated before its first use. A stale identifier
  // opens the queue at its first unit, and it never takes the surface off the screen.
  validateSearch: (search: Record<string, unknown>): ReviewSearch => {
    const { unit, view, group } = search;
    return {
      unit: typeof unit === 'string' ? unit : '',
      view: view === 'decided' || view === 'groups' ? view : 'queue',
      group: typeof group === 'string' ? group : '',
    };
  },

  search: { middlewares: [stripSearchParams({ unit: '', view: 'queue', group: '' })] },

  // The queue reads one page of units. The history reads the whole corpus, and the rail reads the
  // faults of every unit that waits, so each is read only when its page is open.
  loaderDeps: ({ search }) => ({ view: search.view, group: search.group }),
  loader: async ({ deps }) => {
    const [first, relationTypes, entityTypes] = await Promise.all([
      readUnits(null),
      loadRelationTypes(),
      loadEntityTypes(),
    ]);
    const held = { first, relationTypes, entityTypes, history: [], groups: null };
    if (deps.view === 'groups') {
      const [rail, group] = await Promise.all([
        readGroups(),
        deps.group === '' ? null : readGroupUnits(deps.group),
      ]);
      return { ...held, groups: { rail, group } };
    }
    if (deps.view !== 'decided') return held;
    const [corpus, decided] = await Promise.all([loadCorpus(), loadDecidedActs()]);
    return { ...held, history: readDecided(corpus, decided) };
  },

  component: ReviewRoute,
  head: () => ({ meta: [{ title: 'Review · Gabriel' }] }),
});

/** The pages read from the first page that the loader gave, the count of the last read, and
 * whether a read of the next page runs now. A page read again after a decision replaces the page
 * that it was read for. */
interface HeldPages {
  readonly from: UnitPage | null;
  readonly pages: readonly UnitPage[];
  readonly total: number;
  readonly reading: boolean;
}

const startOf = (first: UnitPage | null): HeldPages => ({
  from: first,
  pages: first === null ? [] : [first],
  total: first?.total ?? 0,
  reading: false,
});

function ReviewRoute() {
  const { unit, view, group } = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const { first, relationTypes, entityTypes, history, groups } = Route.useLoaderData();

  // The pages and the decision die with the view: a reload reads the first page again.
  const [held, setHeld] = useState<HeldPages>(startOf(null));
  const [decision, setDecision] = useState<DecisionState>({ step: 'idle' });
  const [groupAction, setGroupAction] = useState<GroupActionState>({ step: 'idle' });

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
            more: now.reading ? 'reading' : last === null ? 'none' : 'ready',
          },
          decision,
        };

  const select = (unitId: string): void => {
    void navigate({ search: (search) => ({ ...search, unit: unitId }), replace: true });
  };

  // Only the page that held the unit is read again, so the rest of the queue keeps its place.
  const readAgain = async (decided: string, mode: 'unit' | 'relation'): Promise<void> => {
    const after = afterDecision(now.pages, decided, mode);
    select(after.next);
    const read = await readUnits(after.after);
    if (read.state !== 'held') return;
    setHeld((before) =>
      before.from === now.from
        ? {
            ...before,
            pages: before.pages.map((page, index) => (index === after.page ? read.page : page)),
            total: read.page.total,
          }
        : before,
    );
  };

  const onAct = (act: ReviewAct): void => {
    switch (act.kind) {
      case 'select':
        select(act.unitId);
        return;
      case 'more':
        if (now.reading || last === null) return;
        setHeld({ ...now, reading: true });
        void readUnits(last).then((read) => {
          setHeld((before) =>
            before.from === now.from
              ? {
                  ...before,
                  pages: read.state === 'held' ? [...before.pages, read.page] : before.pages,
                  total: read.state === 'held' ? read.page.total : before.total,
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

  // A group whose every unit the action wrote waits no more, so its read is refused: the result
  // of the action stays on the screen with the sentence of that read.
  const groupRead = groups?.group ?? null;
  const action: GroupActionState =
    groupAction.step !== 'idle' && groupAction.groupId === group ? groupAction : { step: 'idle' };
  const groupView: GroupView =
    group === '' || groupRead === null
      ? { state: 'none' }
      : groupRead.state === 'private'
        ? { state: 'private', groupId: group, why: groupRead.why, action }
        : { state: 'held', group: groupRead.read, action };

  // The rail, the group and the queue are read again after the action, so each count is the
  // count of the record.
  const onGroupAct = (act: GroupsAct): void => {
    if (act.kind === 'select') {
      void navigate({ search: (search) => ({ ...search, group: act.groupId }), replace: true });
      return;
    }
    const { groupId, unitIds } = act;
    setGroupAction({ step: 'working', groupId });
    void sendGroupAction(groupId, unitIds).then(async (result) => {
      setGroupAction({ ...result, groupId });
      if (result.step === 'done') await router.invalidate();
    });
  };

  return (
    <ReviewSurface
      view={view}
      onView={(next) => {
        void navigate({ search: (search) => ({ ...search, view: next }), replace: true });
      }}
      decided={history}
      queue={<UnitsPage view={queue} selectedId={unit} words={words} onAct={onAct} />}
      groups={
        groups === null ? null : (
          <GroupsPage rail={groups.rail} group={groupView} words={words} onAct={onGroupAct} />
        )
      }
    />
  );
}
