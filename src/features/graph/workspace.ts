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
  // when a document does, and a stored list of the types that are on would dim each new type.
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

// The compiler holds this list closed: a key added to `GraphWorkspace` and forgotten here fails
// the type check, so the guard below cannot fall behind the interface it guards.
const DECLARED_KEYS: Readonly<Record<keyof GraphWorkspace, true>> = {
  camera: true,
  hiddenTypes: true,
  railOpen: true,
};

// The cost of the strict guard here is one camera position and one set of filters, one time.
const isWorkspace = (value: unknown): value is GraphWorkspace => {
  if (!holdsOnlyDeclaredKeys(value, DECLARED_KEYS)) return false;
  const w = value;
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

// Every writer patches, and never replaces: two writers with partial records erase each other.
export function patchGraphWorkspace(patch: Partial<GraphWorkspace>): GraphWorkspace {
  const next: GraphWorkspace = { ...readGraphWorkspace(), ...patch };
  writeWorkspace(FEATURE, next);
  return next;
}
