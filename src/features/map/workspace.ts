import { holdsOnlyDeclaredKeys, readWorkspace, writeWorkspace } from '@/shared/storage';

import { DEFAULT_IMAGERY, isImagery, type Imagery } from './imagery';

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
  readonly imagery: Imagery;
}

export const DEFAULT_WORKSPACE: MapWorkspace = {
  camera: null,
  hiddenTypes: [],
  linksHidden: false,
  railOpen: true,
  ground: 'plan',
  imagery: DEFAULT_IMAGERY,
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
  imagery: true,
};

// The cost of the strict guard here is one camera position, one time.
const isWorkspace = (value: unknown): value is MapWorkspace => {
  if (!holdsOnlyDeclaredKeys(value, DECLARED_KEYS)) return false;
  const w = value;
  const hidden = w['hiddenTypes'];
  return (
    (w['camera'] === null || isCamera(w['camera'])) &&
    Array.isArray(hidden) &&
    hidden.every((type) => typeof type === 'string') &&
    typeof w['linksHidden'] === 'boolean' &&
    typeof w['railOpen'] === 'boolean' &&
    (w['ground'] === 'plan' || w['ground'] === 'imagery') &&
    isImagery(w['imagery'])
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
