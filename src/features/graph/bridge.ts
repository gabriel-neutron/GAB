// The selection leaves on a window event, and not on a property. A property from the route is a
// new function at each render of the route. That defeats the memo that keeps the canvas from a
// re-render, and a re-render of the canvas destroys the Sigma instance and the picture with it.

export const GRAPH_SELECTION_EVENT = 'gab:graph-selection';

export interface GraphSelection {
  readonly kind: 'entity' | 'relation';
  readonly id: string;
}

const isSelection = (value: unknown): value is GraphSelection | null => {
  if (value === null) return true;
  if (typeof value !== 'object') return false;
  const selection = value as Record<string, unknown>;
  return (
    (selection['kind'] === 'entity' || selection['kind'] === 'relation') &&
    typeof selection['id'] === 'string'
  );
};

// A listener of the window is given an `Event`. Only a `CustomEvent` carries `detail`, and the
// `in` operator states that before the read. A cast through `unknown` is refused, and so is a
// non-null assertion.
const carriesDetail = (event: Event): event is CustomEvent<unknown> => 'detail' in event;

// A component that subscribes after the canvas is built has missed the restore: the canvas is a
// child of the route, so its effect runs before the effect of the route. This value is what a
// late subscriber reads, and it is not a second store of the selection.
let announced: GraphSelection | null = null;

export function emitGraphSelection(selection: GraphSelection | null): void {
  announced = selection;
  window.dispatchEvent(
    new CustomEvent<GraphSelection | null>(GRAPH_SELECTION_EVENT, { detail: selection }),
  );
}

// It calls the listener at once with the selection of this moment, and then at each change. Do
// not remove that first call: a subscriber that attaches after the mount never learns what the
// graph restored.
export function onGraphSelection(listener: (selection: GraphSelection | null) => void): () => void {
  const handle = (event: Event): void => {
    if (!carriesDetail(event)) return;
    // An event of this name from another source can carry anything. A value that fails the
    // guard is dropped, and no listener sees a shape it did not ask for.
    if (isSelection(event.detail)) listener(event.detail);
  };

  window.addEventListener(GRAPH_SELECTION_EVENT, handle);
  listener(announced);
  return () => {
    window.removeEventListener(GRAPH_SELECTION_EVENT, handle);
  };
}
