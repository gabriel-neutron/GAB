import { createFileRoute, stripSearchParams, useRouter } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { readAuthorNames } from '@/features/review/author-names';
import type { DecisionState } from '@/features/review/decision-bar';
import { decisionDone } from '@/features/review/decision-done';
import { DecidedPage, type DecidedView } from '@/features/review/decided-page';
import { readDecidedPage, type DecidedRead } from '@/features/review/decided-read';
import type { GroupActionState, GroupView } from '@/features/review/group-panel';
import {
  readGroupUnits,
  readGroups,
  type GroupUnits,
  type GroupsRead,
} from '@/features/review/groups';
import { GroupsPage, type GroupsAct } from '@/features/review/groups-page';
import { afterDecision, queueUnits } from '@/features/review/held-pages';
import { readImoPairs } from '@/features/review/imo-pairs';
import { ImoPairsPage } from '@/features/review/imo-pairs-page';
import { linkedUnit } from '@/features/review/linked-unit';
import { readNameCandidates } from '@/features/review/name-candidates';
import { NameCandidatesPage } from '@/features/review/name-candidates-page';
import { NamesPage } from '@/features/review/names-page';
import { nextGroup } from '@/features/review/next-group';
import { ReviewSurface, type ReviewView } from '@/features/review/review-surface';
import { openQueue } from '@/features/review/queue-start';
import {
  filterIsOn,
  patchQueueFilter,
  patchReviewWorkspace,
} from '@/features/review/review-workspace';
import type { LaneCounts, UnitPage } from '@/features/review/unit-page';
import { unitWords } from '@/features/review/unit-words';
import { sendGroupAction } from '@/features/review/send-group-action';
import { readUnit, readUnits } from '@/features/review/units';
import { UnitsPage, type QueueView, type ReviewAct } from '@/features/review/units-page';
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
      view:
        view === 'decided' ||
        view === 'groups' ||
        view === 'names' ||
        view === 'imo' ||
        view === 'scripts'
          ? view
          : 'queue',
      group: typeof group === 'string' ? group : '',
    };
  },

  search: { middlewares: [stripSearchParams({ unit: '', view: 'queue', group: '' })] },

  // The queue reads one page of units, with the filter and from the place that the workspace
  // holds, so a reload keeps both. A unit of the address that the first page does not hold is
  // read by its identifier. The history and the rail of the groups are read only when their page
  // is open, and so are the names that wait, the pairs of vessels and the merge candidates. The
  // rail is read when its page opens and after a group action, and never at the choice of a
  // group: the group in the address is read here once, and each later choice reads its own group
  // alone.
  loaderDeps: ({ search }) => ({ view: search.view }),
  loader: async ({ deps, location }) => {
    const [{ first, filter }, relationTypes, entityTypes] = await Promise.all([
      openQueue(),
      loadRelationTypes(),
      loadEntityTypes(),
    ]);
    const asked: unknown = Reflect.get(location.search, 'unit');
    const unitId = typeof asked === 'string' ? asked : '';
    const linked = await linkedUnit(unitId, first, readUnit);
    const held = {
      first,
      filter,
      linked,
      relationTypes,
      entityTypes,
      history: null,
      groups: null,
      names: null,
      imoPairs: null,
      nameCandidates: null,
    };
    if (deps.view === 'groups') {
      const asked: unknown = Reflect.get(location.search, 'group');
      const groupId = typeof asked === 'string' ? asked : '';
      const [rail, read] = await Promise.all([
        readGroups(),
        groupId === '' ? null : readGroupUnits(groupId),
      ]);
      return { ...held, groups: { rail, group: read === null ? null : { groupId, read } } };
    }
    if (deps.view === 'names') return { ...held, names: await readAuthorNames() };
    if (deps.view === 'imo') return { ...held, imoPairs: await readImoPairs() };
    if (deps.view === 'scripts') return { ...held, nameCandidates: await readNameCandidates() };
    if (deps.view !== 'decided') return held;
    return { ...held, history: await readDecidedPage(null) };
  },

  component: ReviewRoute,
  head: () => ({ meta: [{ title: 'Review · Gabriel' }] }),
});

/** The pages read from the first page that the loader gave, the counts of the last read (what the
 * rules decided and what is left in each list, and the units that the filter keeps), and
 * whether a read of the next page runs now. A page read again after a decision replaces the page
 * that it was read for. */
interface HeldPages {
  readonly from: UnitPage | null;
  readonly pages: readonly UnitPage[];
  readonly counts: LaneCounts;
  readonly matched: number;
  readonly reading: boolean;
}

const startOf = (first: UnitPage | null): HeldPages => ({
  from: first,
  pages: first === null ? [] : [first],
  counts: first?.counts ?? NO_COUNTS,
  matched: first?.matched ?? 0,
  reading: false,
});

const NO_COUNTS: LaneCounts = { decided: 0, doubt: 0, waiting: 0 };

const NO_CHOICES = { groups: [], documents: [], proposers: [] };

/** The pages of the history read after the first page that the loader gave. */
interface HeldHistory {
  readonly from: DecidedRead | null;
  readonly rows: readonly DecidedRead[];
  readonly reading: boolean;
}

function ReviewRoute() {
  const { unit, view, group } = Route.useSearch();
  const navigate = Route.useNavigate();
  const {
    first,
    filter,
    linked,
    relationTypes,
    entityTypes,
    history,
    groups,
    names,
    imoPairs,
    nameCandidates,
  } = Route.useLoaderData();
  const router = useRouter();

  // The pages and the decision die with the view: a reload reads the first page again.
  const [held, setHeld] = useState<HeldPages>(startOf(null));
  const [decision, setDecision] = useState<DecisionState>({ step: 'idle' });
  const [groupAction, setGroupAction] = useState<GroupActionState>({ step: 'idle' });
  const [later, setLater] = useState<HeldHistory>({ from: null, rows: [], reading: false });
  // The group read at the last choice, or after the last group action. Null while it is read.
  const [picked, setPicked] = useState<{
    readonly groupId: string;
    readonly read: GroupsRead<GroupUnits> | null;
  } | null>(null);

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
            lane: filter.lane,
            units: queueUnits(now.pages),
            total: now.counts[filter.lane],
            matched: now.matched,
            before: now.pages[0]?.before ?? 0,
            filtered: filterIsOn(filter),
            more: now.reading ? 'reading' : last === null ? 'none' : 'ready',
          },
          counts: now.counts,
          filter,
          choices: now.pages.at(-1)?.choices ?? NO_CHOICES,
          linked,
          decision,
        };

  // The place in the queue is the key that the page of the selected unit starts after, so a
  // reload reads that page first.
  const select = (unitId: string): void => {
    const page = now.pages.find((held) => held.units.some((one) => one.id === unitId));
    if (page !== undefined) patchReviewWorkspace({ from: page.after });
    void navigate({ search: (search) => ({ ...search, unit: unitId }), replace: true });
  };

  // A read from the first unit asks the loader for its first page again.
  const readFromStart = (): void => {
    patchReviewWorkspace({ from: null });
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
            counts: read.page.counts,
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
        readFromStart();
        return;
      // The part of the filter that changed is merged into the newest filter.
      case 'filter':
        void navigate({ search: (search) => ({ ...search, unit: '' }), replace: true });
        patchQueueFilter(act.patch);
        void router.invalidate();
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
                  counts: read.state === 'held' ? read.page.counts : before.counts,
                  matched: read.state === 'held' ? read.page.matched : before.matched,
                  reading: false,
                }
              : before,
          );
        });
        return;
      case 'decide': {
        const { unitId, decision: asked } = act;
        const mode = asked.op === 'reject_relation' ? 'relation' : 'unit';
        // A unit of the address that no page read holds is read again by the loader after the
        // rejection of one of its relations. A unit decided whole leaves the screen.
        const linkedOnly = !now.pages.some((page) => page.units.some((one) => one.id === unitId));
        // The held pages are kept as they stand, so the read after the decision replaces one.
        setHeld(now);
        setDecision({ step: 'working', unitId });
        void sendDecision(asked).then(async (result) => {
          if (result.step !== 'done') {
            setDecision({ ...result, unitId });
            return;
          }
          setDecision({ step: 'done', unitId, said: decisionDone(asked, result.written) });
          if (linkedOnly && mode === 'relation') await router.invalidate();
          else await readAgain(unitId, mode);
        });
        return;
      }
    }
  };

  const entered = groups?.group ?? null;
  const groupRead =
    picked !== null && picked.groupId === group
      ? picked.read
      : entered !== null && entered.groupId === group
        ? entered.read
        : null;
  // The result of a done action stays on the screen over the next group that the page opens.
  const action: GroupActionState =
    groupAction.step === 'done' || (groupAction.step !== 'idle' && groupAction.groupId === group)
      ? groupAction
      : { step: 'idle' };
  const groupView: GroupView =
    group === ''
      ? { state: 'none', action }
      : groupRead === null
        ? { state: 'reading', groupId: group }
        : groupRead.state === 'private'
          ? { state: 'private', groupId: group, why: groupRead.why, action }
          : { state: 'held', group: groupRead.read, action };

  const readGroup = async (groupId: string): Promise<void> => {
    const read = await readGroupUnits(groupId);
    setPicked((before) => (before?.groupId === groupId ? { groupId, read } : before));
  };

  const openGroup = (groupId: string): void => {
    setPicked({ groupId, read: null });
    void navigate({ search: (search) => ({ ...search, group: groupId }), replace: true });
    void readGroup(groupId);
  };

  // After the action the page opens the next group of the rail, and the rail and the queue are
  // read again, so each count is the count of the record. The group of the action is not read
  // again: its clean units are written, and the rest waits for a decision of its own.
  const onGroupAct = (act: GroupsAct): void => {
    if (act.kind === 'select') {
      setGroupAction({ step: 'idle' });
      openGroup(act.groupId);
      return;
    }
    const { groupId, unitIds } = act;
    const rail = groups?.rail.state === 'held' ? groups.rail.read : [];
    const name = rail.find((line) => line.id === groupId)?.subject ?? 'with no subject';
    setGroupAction({ step: 'working', groupId });
    void sendGroupAction(groupId, unitIds).then(async (result) => {
      if (result.step !== 'done') {
        setGroupAction({ ...result, groupId });
        return;
      }
      setGroupAction({ ...result, groupId, name });
      const next = nextGroup(rail, groupId);
      if (next === null) {
        setPicked(null);
        await navigate({ search: (search) => ({ ...search, group: '' }), replace: true });
      } else openGroup(next);
      await router.invalidate();
    });
  };

  // The history holds the first page of the loader, then each page read after it.
  const heldLater: HeldHistory =
    later.from === history ? later : { from: history, rows: [], reading: false };
  const lastRead = heldLater.rows.at(-1) ?? history;
  const nextKey = lastRead?.state === 'held' ? lastRead.next : null;
  const decidedView: DecidedView | null =
    history === null
      ? null
      : history.state === 'private'
        ? history
        : {
            state: 'held',
            rows: [history, ...heldLater.rows].flatMap((read) =>
              read.state === 'held' ? read.rows : [],
            ),
            unread: [history, ...heldLater.rows].reduce(
              (sum, read) => sum + (read.state === 'held' ? read.unread : 0),
              0,
            ),
            // A later page that the writer did not give says why, under the rows read.
            why: lastRead?.state === 'private' ? lastRead.why : null,
            more: heldLater.reading ? 'reading' : nextKey === null ? 'none' : 'ready',
          };
  const readMoreDecided = (): void => {
    if (heldLater.reading || nextKey === null) return;
    setLater({ ...heldLater, reading: true });
    void readDecidedPage(nextKey).then((read) => {
      setLater((before) =>
        before.from === history
          ? { ...before, rows: [...before.rows, read], reading: false }
          : before,
      );
    });
  };

  return (
    <ReviewSurface
      view={view}
      onView={(next) => {
        void navigate({ search: (search) => ({ ...search, view: next }), replace: true });
      }}
      queue={<UnitsPage view={queue} selectedId={unit} words={words} onAct={onAct} />}
      page={
        view === 'groups' && groups !== null ? (
          <GroupsPage rail={groups.rail} group={groupView} words={words} onAct={onGroupAct} />
        ) : view === 'decided' && decidedView !== null ? (
          <DecidedPage view={decidedView} onMore={readMoreDecided} />
        ) : view === 'names' && names !== null ? (
          <NamesPage read={names} />
        ) : view === 'imo' && imoPairs !== null ? (
          <ImoPairsPage read={imoPairs} />
        ) : view === 'scripts' && nameCandidates !== null ? (
          <NameCandidatesPage read={nameCandidates} />
        ) : null
      }
    />
  );
}
