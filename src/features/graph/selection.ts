export interface GraphSelection {
  readonly kind: 'entity' | 'relation';
  readonly id: string;
}

export function readSelectionAddress(): GraphSelection | null {
  const params = new URLSearchParams(window.location.search);
  // External constraint: a typed address can carry an empty value. Read as an entity, the
  // controller drops it and never reads the relation beside it, so no relation survives a reload.
  const entity = params.get('entity');
  if (entity !== null && entity !== '') return { kind: 'entity', id: entity };
  const relation = params.get('relation');
  if (relation !== null && relation !== '') return { kind: 'relation', id: relation };
  return null;
}

// External constraint: a write through the router re-renders the route, which destroys the
// canvas and starts the layout again. So the write bypasses the router.
export function writeSelectionAddress(current: GraphSelection | null): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('entity');
  url.searchParams.delete('relation');
  if (current !== null) url.searchParams.set(current.kind, current.id);
  // External constraint: the router keeps its state in the history entry, and a `null` empties it.
  const state: unknown = window.history.state;
  window.history.replaceState(state, '', url);
}
