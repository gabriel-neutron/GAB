/**
 * How the graph tells its neighbour what is selected.
 *
 * The graph announces the selection on an event of the window, and the route listens.
 *
 * **Why an event, and not a property.** A property from the route is a new function on every
 * render of the route. That defeats the memoisation which keeps the canvas from a re-render, and
 * that render is refused: a re-render of the canvas destroys the Sigma instance and the picture
 * with it.
 *
 * **The named precedent, `features/map`, no longer holds the event.**
 * `src/features/map/adapter.ts` says that the map leaves the window event of the prototype
 * behind, and that the handle is the seam there: it has no `CustomEvent` and no `declare global`.
 * The graph surface still asks for the event, and the specification wins on **what**, so the
 * event stays. The conflict is a question for the operator, and this file settles nothing.
 *
 * **The one narrowing of this surface lives here.** The listener helper holds it, so that no
 * route file reads an untyped value. A value from the event is a value from outside, and it
 * passes the guard below before its first use.
 *
 * **The word "bridge" here is the seam that carries the selection, and never the bridge of the
 * graph structure.** A bridge of the structure is a cut point that severs a large piece, and
 * `./structure` owns that word. The two are not the same thing, and this file uses no read of
 * `./structure`.
 */

export const GRAPH_SELECTION_EVENT = 'gab:graph-selection';

/**
 * What the graph announces. `null` says that nothing is selected.
 *
 * The two kinds are a closed set. The route must state two cases on screen: a relation, because
 * the detail surface draws one entity, and an entity that the read does not carry.
 */
export interface GraphSelection {
  readonly kind: 'entity' | 'relation';
  readonly id: string;
}

/** A guard on the value the event carries. `null` is a selection that was dropped. */
const isSelection = (value: unknown): value is GraphSelection | null => {
  if (value === null) return true;
  if (typeof value !== 'object') return false;
  const selection = value as Record<string, unknown>;
  return (
    (selection['kind'] === 'entity' || selection['kind'] === 'relation') &&
    typeof selection['id'] === 'string'
  );
};

/**
 * The narrowing of the event, and it is guarded.
 *
 * A listener of the window is given an `Event`. Only a `CustomEvent` carries `detail`, and the
 * `in` operator states that before the read. A cast through `unknown` is refused, and so is a
 * non-null assertion.
 */
const carriesDetail = (event: Event): event is CustomEvent<unknown> => 'detail' in event;

/**
 * The last selection the graph announced.
 *
 * **A stateless relay loses the restore, and that was a defect.** A component that subscribes
 * after the map is built has already missed the restore: seed from the current selection, then
 * subscribe. The canvas is a child of the route, so its effect runs **before** the effect of the
 * route, and the mount announces the restored selection into an empty room.
 *
 * The route then kept its own seed, read from the address, while the graph had already dropped a
 * selection it cannot draw and corrected the address. The sidebar drew one entity, the canvas
 * marked nothing, and the address named neither. **Three surfaces and two answers.**
 *
 * This value is what a late subscriber reads. It is not a second store of the selection: the
 * graph owns that, and this is the record of what the graph last said.
 */
let announced: GraphSelection | null = null;

export function emitGraphSelection(selection: GraphSelection | null): void {
  announced = selection;
  window.dispatchEvent(
    new CustomEvent<GraphSelection | null>(GRAPH_SELECTION_EVENT, { detail: selection }),
  );
}

/**
 * Listens for the selection of the graph. It returns the function that stops the listener, so
 * the caller keeps no name of its own and cannot remove the wrong one.
 *
 * **It calls the listener at once with the selection of this moment, and then at each change.**
 * That is the shape of `onSelect` in `src/features/map/adapter.ts`, which is the precedent, and
 * every subscriber of a live canvas requires it. **Do not remove the first call**: without it a
 * subscriber that attaches after the mount never learns what the graph restored, and it keeps
 * whatever it guessed instead.
 */
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
