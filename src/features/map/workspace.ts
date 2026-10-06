import { holdsOnlyDeclaredKeys, readWorkspace, writeWorkspace } from '@/shared/storage';

import { DEFAULT_IMAGERY, isImagery, type Imagery } from './imagery';

const FEATURE = 'map';

export type Ground = 'plan' | 'imagery';

interface Camera {
  readonly lon: number;
  readonly lat: number;
  readonly zoom: number;
}

interface MapWorkspace {
  readonly camera: Camera | null;
  // The types that are switched OFF, and never the types that are on. The corpus gains a type
  // when a document does, and a stored list of the types that are on would hide each new type.
  readonly hiddenTypes: readonly string[];
  readonly linksHidden: boolean;
  readonly railOpen: boolean;
  /** The width of the open rail, in pixels. The rail clamps it where it draws it. */
  readonly railWidth: number;
  readonly ground: Ground;
  readonly imagery: Imagery;
}

const DEFAULT_WORKSPACE: MapWorkspace = {
  camera: null,
  hiddenTypes: [],
  linksHidden: false,
  railOpen: true,
  railWidth: 240,
  ground: 'plan',
  imagery: DEFAULT_IMAGERY,
};

const isCamera = (value: unknown): value is Camera =>
  typeof value === 'object' &&
  value !== null &&
  'lon' in value &&
  'lat' in value &&
  'zoom' in value &&
  typeof value.lon === 'number' &&
  typeof value.lat === 'number' &&
  typeof value.zoom === 'number' &&
  Number.isFinite(value.lon) &&
  Number.isFinite(value.lat) &&
  Number.isFinite(value.zoom);

// The compiler holds this list closed: a key added to `MapWorkspace` and forgotten here fails the
// type check, so the guard below cannot fall behind the interface it guards.
const DECLARED_KEYS: Readonly<Record<keyof MapWorkspace, true>> = {
  camera: true,
  hiddenTypes: true,
  linksHidden: true,
  railOpen: true,
  railWidth: true,
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
    typeof w['railWidth'] === 'number' &&
    Number.isFinite(w['railWidth']) &&
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
