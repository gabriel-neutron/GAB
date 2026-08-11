/**
 * PROTOTYPE — throwaway. How the graph speaks to whatever stands beside it.
 *
 * ADR 0004 §5 refuses a feature that imports a feature, so `features/graph/` cannot reach the
 * detail sidebar and must not try. The **route** composes the two, and this file is the only
 * thing the route needs to know about.
 *
 * A window event, and not a callback prop. A prop from the route would be a new function on every
 * route render, which defeats the `memo` that keeps the canvas from re-rendering — and ADR 0004
 * §3 forbids that re-render. `features/map/prototype-map.ts` set this pattern first with
 * `gab:map-selection`; this is the same idea with the same reason.
 */

export const GRAPH_SELECTION_EVENT = 'gab:graph-selection';
export const GRAPH_COST_EVENT = 'gab:graph-cost';

export interface GraphSelectionDetail {
  readonly kind: 'entity' | 'relation';
  readonly id: string;
}

export function emitGraphSelection(selection: GraphSelectionDetail | null): void {
  window.dispatchEvent(
    new CustomEvent<GraphSelectionDetail | null>(GRAPH_SELECTION_EVENT, { detail: selection }),
  );
}

export function emitGraphCost(line: string): void {
  window.dispatchEvent(new CustomEvent<string>(GRAPH_COST_EVENT, { detail: line }));
}

/** The cast lives here, once, so that no route file reads an untyped `detail`. */
export function onGraphSelection(
  listener: (selection: GraphSelectionDetail | null) => void,
): () => void {
  const handler = (event: Event): void => {
    listener((event as CustomEvent<GraphSelectionDetail | null>).detail);
  };
  window.addEventListener(GRAPH_SELECTION_EVENT, handler);
  return () => {
    window.removeEventListener(GRAPH_SELECTION_EVENT, handler);
  };
}

export function onGraphCost(listener: (line: string) => void): () => void {
  const handler = (event: Event): void => {
    listener((event as CustomEvent<string>).detail);
  };
  window.addEventListener(GRAPH_COST_EVENT, handler);
  return () => {
    window.removeEventListener(GRAPH_COST_EVENT, handler);
  };
}
