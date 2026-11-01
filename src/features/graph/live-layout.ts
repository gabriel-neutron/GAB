// The live layout. A worker runs ForceAtlas2 for the shown nodes, so the page keeps its frame
// rate on 3000 nodes, and the page paints each answer of the worker, until the picture settles.

import type { LayoutInput } from './layout-weights';
import type { InMessage, OutMessage } from './layout-worker';
import type { ForceSettings } from './variants';

// The nodes with no link stand in rings at the edge of the frame. This is the gap between two of
// them, as a share of the frame, and the radius at which the rings stop. A set of nodes that
// the rings cannot hold at this gap keeps the places it held.
const RING_GAP = 0.016;
const RING_INNER = 0.08;
// The least radius of the linked picture, as a share of the frame.
const CORE_MIN = 0.12;

interface Point {
  x: number;
  y: number;
}

/** The part of a worker that the layout uses, so a test can stand in for it. */
export interface LayoutEngine {
  postMessage: (message: InMessage, options?: StructuredSerializeOptions) => void;
  onmessage: ((event: MessageEvent<OutMessage>) => void) | null;
}

export interface LiveLayout {
  /** Starts a run for these nodes and links, from the places they hold now. */
  readonly run: (input: LayoutInput, forces: ForceSettings) => void;
  readonly stop: () => void;
  /** Ends the use of the worker. */
  readonly destroy: () => void;
}

/**
 * `raw` keeps the layout coordinates across runs. `write` receives the places of the nodes that
 * moved, scaled to the frame of the canvas, in one call. A node that is new to the run starts
 * near the middle of the nodes that it joins, so it returns to its neighbours.
 */
export function createLiveLayout(
  raw: Map<string, Point>,
  frame: { readonly cx: number; readonly cy: number; readonly span: number },
  write: (places: ReadonlyMap<string, Point>) => void,
  engine: LayoutEngine,
): LiveLayout {
  let known = new Set(raw.keys());
  let serial = 0;
  let order: readonly string[] = [];
  let reach = 0.5;
  const placeOf = (node: string): Point => raw.get(node) ?? { x: 0, y: 0 };

  /** The rings of the nodes with no link, from the edge of the frame inward. Returns the radius,
   * as a share of the frame, that is left for the linked picture. */
  const ring = (rest: readonly string[]): number => {
    const places = new Map<string, Point>();
    let radius = 0.5;
    let index = 0;
    while (index < rest.length && radius > RING_INNER) {
      const room = Math.max(1, Math.floor((2 * Math.PI * radius) / RING_GAP));
      const count = Math.min(room, rest.length - index);
      for (let slot = 0; slot < count; slot += 1) {
        const angle = (2 * Math.PI * slot) / count;
        const id = rest[index + slot];
        if (id === undefined) continue;
        places.set(id, {
          x: frame.cx + frame.span * radius * Math.cos(angle),
          y: frame.cy + frame.span * radius * Math.sin(angle),
        });
      }
      index += count;
      radius -= RING_GAP;
    }
    write(places);
    return rest.length === 0 ? 0.5 : Math.max(CORE_MIN, radius - RING_GAP);
  };

  const median = (values: number[]): number => {
    values.sort((one, two) => one - two);
    return values[Math.floor(values.length / 2)] ?? 0;
  };

  // The picture is centred on the median, and its radius is the radius of 98% of the nodes. A
  // node that the forces throw further is pulled back to a thin band outside that radius, so
  // one far node cannot shrink the rest, and the band is a circle and not a frame.
  const paint = (nodes: readonly string[]): void => {
    const midX = median(nodes.map((node) => placeOf(node).x));
    const midY = median(nodes.map((node) => placeOf(node).y));
    const distances = nodes
      .map((node) => Math.hypot(placeOf(node).x - midX, placeOf(node).y - midY))
      .sort((one, two) => one - two);
    const inner = Math.max(distances[Math.floor(distances.length * 0.98)] ?? 0, Number.EPSILON);
    const scale = (reach * frame.span) / (inner * 1.1);
    const places = new Map<string, Point>();
    for (const node of nodes) {
      const at = placeOf(node);
      const dx = at.x - midX;
      const dy = at.y - midY;
      const far = Math.hypot(dx, dy);
      const shown = far <= inner ? far : inner * (1 + 0.1 * (1 - Math.exp(-(far - inner) / inner)));
      const factor = far === 0 ? 0 : (shown / far) * scale;
      places.set(node, { x: frame.cx + dx * factor, y: frame.cy + dy * factor });
    }
    write(places);
  };

  engine.onmessage = (event) => {
    const { id, places } = event.data;
    if (id !== serial) return;
    order.forEach((node, index) => {
      raw.set(node, { x: places[2 * index] ?? 0, y: places[2 * index + 1] ?? 0 });
    });
    paint(order);
  };

  const stop = (): void => {
    serial += 1;
    engine.postMessage({ type: 'stop' });
  };

  const run = (input: LayoutInput, forces: ForceSettings): void => {
    stop();
    const { nodes, links, rest } = input;
    reach = ring(rest);
    order = nodes;
    if (nodes.length === 0) {
      known = new Set();
      return;
    }
    const near = new Map<string, string[]>();
    const join = (from: string, to: string): void => {
      const held = near.get(from);
      if (held === undefined) near.set(from, [to]);
      else held.push(to);
    };
    for (const { source, target } of links) {
      join(source, target);
      join(target, source);
    }
    // A returning node goes to the mean of the neighbours that already hold a place, with a
    // small fixed offset from its position in the list so two such nodes do not stack.
    const places = new Float64Array(2 * nodes.length);
    nodes.forEach((node, index) => {
      if (!raw.has(node) || !known.has(node)) {
        const held = (near.get(node) ?? []).flatMap((id) => {
          const at = raw.get(id);
          return at === undefined ? [] : [at];
        });
        if (held.length > 0) {
          const x = held.reduce((sum, at) => sum + at.x, 0) / held.length;
          const y = held.reduce((sum, at) => sum + at.y, 0) / held.length;
          raw.set(node, { x: x + Math.cos(index) * 0.01, y: y + Math.sin(index) * 0.01 });
        }
      }
      const at = raw.get(node) ?? { x: Math.cos(index), y: Math.sin(index) };
      places[2 * index] = at.x;
      places[2 * index + 1] = at.y;
    });
    known = new Set(nodes);
    const slotOf = new Map(nodes.map((node, index) => [node, index] as const));
    const ends = new Uint32Array(2 * links.length);
    const weights = new Float64Array(links.length);
    links.forEach(({ source, target, weight }, link) => {
      ends[2 * link] = slotOf.get(source) ?? 0;
      ends[2 * link + 1] = slotOf.get(target) ?? 0;
      weights[link] = weight;
    });
    engine.postMessage({
      type: 'run',
      id: serial,
      count: nodes.length,
      places,
      ends,
      weights,
      forces,
    });
  };

  return {
    run,
    stop,
    destroy: () => {
      serial += 1;
      engine.postMessage({ type: 'stop' });
      engine.onmessage = null;
    },
  };
}
