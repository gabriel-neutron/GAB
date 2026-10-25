import { z } from 'zod';

import { runLayout } from './layout-job.ts';
import type { Queryable } from './queryable.ts';

/** The count of new entities, with no relation, that the worker leaves unplaced. The surface places
 * such an entity near its neighbours, so a few of them need no run. */
export const LAYOUT_NEW_ENTITIES = 20;

/** The shortest time between two runs, so a burst of promotions causes no run one after another. */
export const LAYOUT_MIN_GAP_MS = 60_000;

/** The age at which the worker runs the layout again, with or without a change. */
export const LAYOUT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Departure: the worker cannot read the table of the layout, and a new grant for it is not worth one
// read. So the worker keeps the basis of its last run in memory and compares the record with it.
// After a restart the worker has no basis, and its first idle step runs the layout once.
// The relations count only when both ends are entities, as in the run itself. `updated_at` moves
// when a promotion changes a relation, and the count catches a relation that a merge removes.
const BASIS = `SELECT (SELECT count(*) FROM public.entities)::int AS entities,
  (SELECT count(*) FROM public.relations
    WHERE src_kind = 'entity' AND dst_kind = 'entity')::int AS relations,
  (SELECT max(updated_at) FROM public.relations
    WHERE src_kind = 'entity' AND dst_kind = 'entity')::text AS newest`;

const basisRow = z.object({
  entities: z.number(),
  relations: z.number(),
  newest: z.string().nullable(),
});

type Basis = z.infer<typeof basisRow>;

interface LastRun {
  readonly basis: Basis;
  /** The entities that the run placed. */
  readonly placed: number;
  readonly at: number;
}

interface RefresherDeps {
  readonly db: Queryable;
  /** The clock in milliseconds. */
  readonly now: () => number;
}

const sameRelations = (one: Basis, two: Basis): boolean =>
  one.relations === two.relations && one.newest === two.newest;

/** Makes the step that the worker takes when the queue is empty: it runs the layout again when the
 * stored layout is stale. The step never throws. A run that fails goes to the log, and a later
 * idle step tries again. */
export const layoutRefresher = (deps: RefresherDeps): (() => Promise<void>) => {
  let last: LastRun | null = null;
  // The time of the last try, also a failed one, so a fault does not make a run each step.
  let triedAt: number | null = null;

  const stale = (basis: Basis, at: number): boolean => {
    if (last === null) return true;
    if (at - last.at >= LAYOUT_MAX_AGE_MS) return true;
    if (!sameRelations(basis, last.basis)) return true;
    return Math.abs(basis.entities - last.placed) >= LAYOUT_NEW_ENTITIES;
  };

  const attempt = async (): Promise<void> => {
    try {
      const at = deps.now();
      if (triedAt !== null && at - triedAt < LAYOUT_MIN_GAP_MS) return;
      const basis = basisRow.parse((await deps.db.query(BASIS)).rows[0]);
      if (!stale(basis, at)) return;
      triedAt = at;
      // The basis is read before the run, so a change during the run makes the next check stale.
      const placed = await runLayout(deps.db);
      last = { basis, placed, at };
    } catch (cause) {
      console.error('the layout refresh failed, and the worker goes on', cause);
    }
  };

  // Idle slots of a runner call this together, and they share one attempt.
  let running: Promise<void> | null = null;
  return () => (running ??= attempt().finally(() => (running = null)));
};
