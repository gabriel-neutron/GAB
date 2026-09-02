import { readWorkspace, writeWorkspace } from '@/shared/storage';

const FEATURE = 'map';

export type Ground = 'plan' | 'imagery';

export interface Camera {
  readonly lon: number;
  readonly lat: number;
  readonly zoom: number;
}

export interface MapWorkspace {
  readonly camera: Camera | null;
  // The types that are switched OFF, and never the types that are on. The corpus gains a type
  // when a document does, and a stored list of the types that are on would hide each new type.
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

// The compiler holds this list closed: a key added to `MapWorkspace` and forgotten here fails the
// type check, so the guard below cannot fall behind the interface it guards.
const DECLARED_KEYS: Readonly<Record<keyof MapWorkspace, true>> = {
  camera: true,
  hiddenTypes: true,
  linksHidden: true,
  railOpen: true,
  ground: true,
};

// The guard is strict: a record that carries an undeclared key falls back, which costs one camera
// position, once. A tolerant guard lets a dead key outlive the code that read it, because the
// patch below spreads the record and writes the dead key back for ever.
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

// Every writer patches, and never replaces: two writers with partial records erase each other.
export function patchMapWorkspace(patch: Partial<MapWorkspace>): MapWorkspace {
  const next: MapWorkspace = { ...readMapWorkspace(), ...patch };
  writeWorkspace(FEATURE, next);
  return next;
}
