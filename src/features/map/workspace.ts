/**
 * The workspace of the map surface.
 *
 * Built from `docs/map-surface.md` §4.4 and §5.4. ADR 0004 §7 puts the workspace in
 * `localStorage` under one key per feature, and puts identity in the address. So this file holds
 * the camera, the types that are switched off, the state of the rail and the ground in use.
 *
 * **The selection is not here.** It is identity, and it is in the address —
 * `docs/map-surface.md` §3.4.
 *
 * **It holds no React value and causes no render.** ADR 0004 §3. The map owns a live canvas, and
 * every value here is read at mount and written on change, outside React.
 */

import { readWorkspace, writeWorkspace } from '@/shared/storage';

const FEATURE = 'map';

export type Ground = 'plan' | 'imagery';

export interface Camera {
  readonly lon: number;
  readonly lat: number;
  readonly zoom: number;
}

export interface MapWorkspace {
  /** `null` until the first camera is stored, so the first open frames the corpus instead. */
  readonly camera: Camera | null;
  /**
   * **The types that are switched OFF, and never the types that are on** —
   * `docs/map-surface.md` §5.2.
   *
   * The type list is a projection (ADR 0005 §6), so the corpus gains a type whenever a document
   * does. A stored list of the types that are on meets that new type already excluded, hides it
   * on every open, and says nothing.
   */
  readonly hiddenTypes: readonly string[];
  readonly linksHidden: boolean;
  readonly railOpen: boolean;
  readonly ground: Ground;
}

export const DEFAULT_WORKSPACE: MapWorkspace = {
  camera: null,
  hiddenTypes: [],
  linksHidden: false,
  railOpen: true,
  ground: 'plan',
};

const isCamera = (value: unknown): value is Camera => {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c['lon'] === 'number' &&
    typeof c['lat'] === 'number' &&
    typeof c['zoom'] === 'number' &&
    Number.isFinite(c['lon']) &&
    Number.isFinite(c['lat']) &&
    Number.isFinite(c['zoom'])
  );
};

/**
 * Every key this shape declares. **The compiler holds the list closed**: a key added to
 * `MapWorkspace` and forgotten here fails the type check, so the guard below cannot fall behind
 * the interface it guards.
 */
const DECLARED_KEYS: Readonly<Record<keyof MapWorkspace, true>> = {
  camera: true,
  hiddenTypes: true,
  linksHidden: true,
  railOpen: true,
  ground: true,
};

/**
 * **The guard is strict, and a record that carries an undeclared key falls back** —
 * `docs/map-surface.md` §4.4. A record of an older shape falls back, which costs one camera
 * position, once. A tolerant guard lets two shapes live under one key, and that is the fault the
 * version in the key exists to prevent.
 *
 * **The defect this deletes: a guard that accepts a superset lets a dead key outlive the code that
 * read it.** The guard tested the required keys alone, so a record with a key this shape shrank
 * away from passed it, `patchMapWorkspace` spread it, and the dead key was written back under one
 * key for ever. The version in the key answers a **later** shape, and never an earlier one.
 * `src/features/graph/workspace.ts` states the same rule.
 */
const isWorkspace = (value: unknown): value is MapWorkspace => {
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
    typeof w['linksHidden'] === 'boolean' &&
    typeof w['railOpen'] === 'boolean' &&
    (w['ground'] === 'plan' || w['ground'] === 'imagery')
  );
};

export function readMapWorkspace(): MapWorkspace {
  return readWorkspace(FEATURE, isWorkspace, DEFAULT_WORKSPACE);
}

/**
 * **Every writer patches, and never replaces** — `docs/map-surface.md` §4.4.
 *
 * There are four writers: the camera, the rail, the ground and the type switches. Two writers
 * that each hold a partial record erase the other's field. Reading before every write costs one
 * `localStorage` read and removes the whole class of fault.
 */
export function patchMapWorkspace(patch: Partial<MapWorkspace>): MapWorkspace {
  const next: MapWorkspace = { ...readMapWorkspace(), ...patch };
  writeWorkspace(FEATURE, next);
  return next;
}
