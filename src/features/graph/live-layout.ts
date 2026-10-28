// The live layout. It moves the shown nodes by short steps of ForceAtlas2, one batch for each
// animation frame, so the page stays alive on 3000 nodes, and it stops when the picture settles.

import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

import type { LayoutInput } from './layout-weights';
import type { ForceSettings } from './variants';

// Iterations for each frame: a batch of 6 costs a few ms at 3000 nodes with the Barnes-Hut tree.
const STEP = 6;
// The run stops after this many frames, settled or not, so a graph that never rests still ends.
const MAX_FRAMES = 120;
// The run stops when the mean move of a node in one batch falls under this share of the picture.
const SETTLED = 0.0004;

// The nodes with no link stand in rings at the edge of the frame. This is the gap between two of
// them, as a share of the frame, and the share of the frame that the rings may take at most.
const RING_GAP = 0.016;
const RING_MAX = 0.38;
// The least radius of the linked picture, as a share of the frame.
const CORE_MIN = 0.12;

interface Point {
  x: number;
  y: number;
}

export interface LiveLayout {
  /** Starts a run for these nodes and links, from the places they hold now. */
  readonly run: (input: LayoutInput, forces: ForceSettings) => void;
  readonly stop: () => void;
}

/**
 * `raw` keeps the layout coordinates across runs. `write` receives a node and its place, scaled
 * to the frame of the canvas. A node that is new to the run starts near the middle of the nodes
 * that it joins, so it returns to its neighbours.
 */
export function createLiveLayout(
  raw: Map<string, Point>,
  frame: { readonly cx: number; readonly cy: number; readonly span: number },
  write: (node: string, at: Point) => void,
  step: () => void,
): LiveLayout {
  let handle = 0;
  let known = new Set(raw.keys());
  const placeOf = (node: string): Point => raw.get(node) ?? { x: 0, y: 0 };

  const stop = (): void => {
    if (handle !== 0) cancelAnimationFrame(handle);
    handle = 0;
  };

  /** The rings of the nodes with no link, from the edge of the frame inward. Returns the radius,
   * as a share of the frame, that is left for the linked picture. */
  const ring = (rest: readonly string[]): number => {
    let radius = 0.5;
    let index = 0;
    while (index < rest.length && radius > 0.5 - RING_MAX) {
      const room = Math.max(1, Math.floor((2 * Math.PI * radius) / RING_GAP));
      const count = Math.min(room, rest.length - index);
      for (let slot = 0; slot < count; slot += 1) {
        const angle = (2 * Math.PI * slot) / count;
        const id = rest[index + slot];
        if (id === undefined) continue;
        write(id, {
          x: frame.cx + frame.span * radius * Math.cos(angle),
          y: frame.cy + frame.span * radius * Math.sin(angle),
        });
      }
      index += count;
      radius -= RING_GAP;
    }
    // A band that would fill more than the share allowed takes the nodes on the last ring.
    for (; index < rest.length; index += 1) {
      const id = rest[index];
      if (id !== undefined) write(id, { x: frame.cx, y: frame.cy });
    }
    return rest.length === 0 ? 0.5 : Math.max(CORE_MIN, radius - RING_GAP);
  };

  // The bounds of the picture leave out the 2% of nodes at each end of an axis, so one node that
  // the forces throw far away cannot shrink the rest. That node stands on the border.
  const boundsOf = (values: number[]): [number, number] => {
    values.sort((one, two) => one - two);
    const cut = Math.floor(values.length * 0.02);
    return [values[cut] ?? 0, values[values.length - 1 - cut] ?? 0];
  };

  const paint = (nodes: readonly string[], reach: number): void => {
    const [minX, maxX] = boundsOf(nodes.map((node) => placeOf(node).x));
    const [minY, maxY] = boundsOf(nodes.map((node) => placeOf(node).y));
    // One scale for both axes, so the picture keeps its shape, inside the radius that is left.
    const scale = (2 * reach * frame.span) / Math.max(maxX - minX, maxY - minY, Number.EPSILON);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const half = Math.max(maxX - minX, maxY - minY) / 2;
    const clamp = (value: number): number => Math.max(-half, Math.min(half, value));
    for (const node of nodes) {
      const at = placeOf(node);
      write(node, {
        x: frame.cx + clamp(at.x - midX) * scale,
        y: frame.cy + clamp(at.y - midY) * scale,
      });
    }
  };

  const run = (input: LayoutInput, forces: ForceSettings): void => {
    stop();
    const { nodes, links, rest } = input;
    const reach = ring(rest);
    if (nodes.length === 0) {
      step();
      known = new Set();
      return;
    }
    const graph = new Graph({ type: 'undirected', multi: false });
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
      graph.addNode(node, { x: at.x, y: at.y });
    });
    for (const { source, target, weight } of links) {
      graph.addEdge(source, target, { weight });
    }
    known = new Set(nodes);

    const settings = {
      ...forces,
      edgeWeightInfluence: 1,
      barnesHutOptimize: true,
      slowDown: 4,
    };
    let frames = 0;
    const tick = (): void => {
      handle = 0;
      const moved = forceAtlas2(graph, { iterations: STEP, settings, getEdgeWeight: 'weight' });
      let travel = 0;
      for (const node of nodes) {
        const next = moved[node] ?? placeOf(node);
        const before = raw.get(node);
        if (before !== undefined) travel += Math.hypot(next.x - before.x, next.y - before.y);
        raw.set(node, next);
        graph.mergeNodeAttributes(node, next);
      }
      paint(nodes, reach);
      step();
      frames += 1;
      let span = Number.EPSILON;
      for (const node of nodes) {
        const at = placeOf(node);
        span = Math.max(span, Math.abs(at.x), Math.abs(at.y));
      }
      if (frames >= MAX_FRAMES || travel / nodes.length / span < SETTLED) {
        return;
      }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
  };

  return { run, stop };
}
