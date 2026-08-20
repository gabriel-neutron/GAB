/**
 * The workspace of the graph surface.
 *
 * The workspace is in `localStorage` under one key per feature, and identity is in the address.
 * So this file holds the camera, the type filter, and the open state of the two panels.
 *
 * **A degree floor and a pending switch were stored here, and no control wrote either.** A
 * control that can exclude everything carries the way back, and the rail carries it for the types
 * alone: a stored degree floor dimmed the whole corpus on every open with no way back. A pending
 * switch also presumes an answer that the tracker carries, and it is open. Neither returns
 * without a control and a decision.
 *
 * **The selection is not here.** It is identity, and it is in the address.
 * `src/features/map/workspace.ts` states the same rule.
 *
 * **It holds no React value and causes no render.** The graph owns a live canvas, and every value
 * here is read at mount and written on change, outside React.
 *
 * **This is the key of the real feature.** A prototype never occupies it.
 */

import { readWorkspace, writeWorkspace } from '@/shared/storage';

const FEATURE = 'graph';

/** Where the Sigma camera sits. `ratio` is the zoom of Sigma, and a larger ratio is further out. */
export interface GraphCamera {
  readonly x: number;
  readonly y: number;
  readonly ratio: number;
}

export interface GraphWorkspace {
  /** `null` until the first camera is stored, so the first open frames the graph instead. */
  readonly camera: GraphCamera | null;
  /**
   * **The types that are switched OFF, and never the types that are on.**
   *
   * The type list is a projection of the data, so the corpus gains a type whenever a document
   * does. A stored list of the types that are on meets that new type already
   * excluded, dims it on every open, and says nothing. `features/map` stores the excluded set
   * for the same reason.
   */
  readonly hiddenTypes: readonly string[];
  readonly railOpen: boolean;
}

export const DEFAULT_GRAPH_WORKSPACE: GraphWorkspace = {
  camera: null,
  hiddenTypes: [],
  railOpen: true,
};

const isCamera = (value: unknown): value is GraphCamera => {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c['x'] === 'number' &&
    typeof c['y'] === 'number' &&
    typeof c['ratio'] === 'number' &&
    Number.isFinite(c['x']) &&
    Number.isFinite(c['y']) &&
    Number.isFinite(c['ratio'])
  );
};

/**
 * Every key this shape declares. **The compiler holds the list closed**: a key added to
 * `GraphWorkspace` and forgotten here fails the type check, so the guard below cannot fall behind
 * the interface it guards.
 */
const DECLARED_KEYS: Readonly<Record<keyof GraphWorkspace, true>> = {
  camera: true,
  hiddenTypes: true,
  railOpen: true,
};

/**
 * **The guard is strict, and a record that carries an undeclared key falls back.** That costs one
 * camera position and one set of filters, one time.
 *
 * **The defect this deletes: a guard that accepts a superset lets a dead key outlive the code that
 * read it.** The guard tested the required keys alone, so the record this surface wrote yesterday
 * — which carried `minDegree` and `onlyPending`, both now deleted — passed it, `patchGraphWorkspace`
 * spread it, and the two dead keys were written back under one key for ever. The version in the
 * key answers a **later** shape, and never an earlier one that this shape shrank away from.
 */
const isWorkspace = (value: unknown): value is GraphWorkspace => {
  if (typeof value !== 'object' || value === null) return false;
  const w = value as Record<string, unknown>;
  for (const key of Object.keys(w)) {
    if (!Object.hasOwn(DECLARED_KEYS, key)) return false;
  }
  const hidden = w['hiddenTypes'];
  return (
    (w['camera'] === null || isCamera(w['camera'])) &&
    Array.isArray(hidden) &&
    hidden.every((type) => typeof type === 'string') &&
    typeof w['railOpen'] === 'boolean'
  );
};

export function readGraphWorkspace(): GraphWorkspace {
  return readWorkspace(FEATURE, isWorkspace, DEFAULT_GRAPH_WORKSPACE);
}

/**
 * **Every writer patches, and never replaces.**
 *
 * There are three writers, and `./controller` holds each one: the camera, the rail and
 * the type switches. Two writers that each hold a partial record erase the other's field. Reading
 * before every write costs one `localStorage` read and removes the whole class of fault.
 */
export function patchGraphWorkspace(patch: Partial<GraphWorkspace>): GraphWorkspace {
  const next: GraphWorkspace = { ...readGraphWorkspace(), ...patch };
  writeWorkspace(FEATURE, next);
  return next;
}
