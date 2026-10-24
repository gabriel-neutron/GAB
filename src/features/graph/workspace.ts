import { holdsOnlyDeclaredKeys, readWorkspace, writeWorkspace } from '@/shared/storage';

const FEATURE = 'graph';

// `ratio` is the zoom of Sigma, and a larger ratio is further out.
export interface GraphCamera {
  readonly x: number;
  readonly y: number;
  readonly ratio: number;
}

export interface GraphWorkspace {
  readonly camera: GraphCamera | null;
  // The types that are switched OFF, and never the types that are on. The corpus gains a type
  // when a document does, and a stored list of the types that are on would hide each new type.
  readonly hiddenTypes: readonly string[];
  readonly railOpen: boolean;
  /** The width of the open rail, in pixels. The rail clamps it where it draws it. */
  readonly railWidth: number;
  /** Whether the canvas draws the entities that stand on the ring with no place. */
  readonly showUnplaced: boolean;
  /** The relation types that are switched OFF, on the same rule as `hiddenTypes`. */
  readonly hiddenRelationTypes: readonly string[];
}

export const DEFAULT_GRAPH_WORKSPACE: GraphWorkspace = {
  camera: null,
  hiddenTypes: [],
  railOpen: true,
  railWidth: 256,
  showUnplaced: true,
  hiddenRelationTypes: [],
};

// A record saved before a switch existed has no key for it. It stays valid, so the camera, the
// filters and the rail of that reader are kept, and the switch takes its default.
type StoredWorkspace = Omit<GraphWorkspace, 'showUnplaced' | 'hiddenRelationTypes'> & {
  readonly showUnplaced?: boolean;
  readonly hiddenRelationTypes?: readonly string[];
};

const isCamera = (value: unknown): value is GraphCamera =>
  typeof value === 'object' &&
  value !== null &&
  'x' in value &&
  'y' in value &&
  'ratio' in value &&
  typeof value.x === 'number' &&
  typeof value.y === 'number' &&
  typeof value.ratio === 'number' &&
  Number.isFinite(value.x) &&
  Number.isFinite(value.y) &&
  Number.isFinite(value.ratio);

// The compiler holds this list closed: a key added to `GraphWorkspace` and forgotten here fails
// the type check, so the guard below cannot fall behind the interface it guards.
const DECLARED_KEYS: Readonly<Record<keyof GraphWorkspace, true>> = {
  camera: true,
  hiddenTypes: true,
  railOpen: true,
  railWidth: true,
  showUnplaced: true,
  hiddenRelationTypes: true,
};

// A record saved while the graph had a focus holds `hops`. The guard accepts the key, and the read
// drops it, so the camera and the filters of that reader are kept.
const READ_KEYS: Readonly<Record<string, true>> = { ...DECLARED_KEYS, hops: true };

// The cost of the strict guard here is one camera position and one set of filters, one time.
const isWorkspace = (value: unknown): value is StoredWorkspace => {
  if (!holdsOnlyDeclaredKeys(value, READ_KEYS)) return false;
  const w = value;
  const hidden = w['hiddenTypes'];
  return (
    (w['camera'] === null || isCamera(w['camera'])) &&
    Array.isArray(hidden) &&
    hidden.every((type) => typeof type === 'string') &&
    typeof w['railOpen'] === 'boolean' &&
    typeof w['railWidth'] === 'number' &&
    Number.isFinite(w['railWidth']) &&
    (w['showUnplaced'] === undefined || typeof w['showUnplaced'] === 'boolean') &&
    (w['hiddenRelationTypes'] === undefined ||
      (Array.isArray(w['hiddenRelationTypes']) &&
        w['hiddenRelationTypes'].every((type) => typeof type === 'string')))
  );
};

export function readGraphWorkspace(): GraphWorkspace {
  const stored = readWorkspace<StoredWorkspace>(FEATURE, isWorkspace, DEFAULT_GRAPH_WORKSPACE);
  return {
    camera: stored.camera,
    hiddenTypes: stored.hiddenTypes,
    railOpen: stored.railOpen,
    railWidth: stored.railWidth,
    showUnplaced: stored.showUnplaced ?? DEFAULT_GRAPH_WORKSPACE.showUnplaced,
    hiddenRelationTypes: stored.hiddenRelationTypes ?? DEFAULT_GRAPH_WORKSPACE.hiddenRelationTypes,
  };
}

// Every writer patches, and never replaces: two writers with partial records erase each other.
export function patchGraphWorkspace(patch: Partial<GraphWorkspace>): GraphWorkspace {
  const next: GraphWorkspace = { ...readGraphWorkspace(), ...patch };
  writeWorkspace(FEATURE, next);
  return next;
}
