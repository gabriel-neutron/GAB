// The live layout. It moves the shown nodes by short steps of ForceAtlas2, one batch for each
// animation frame, so the page stays alive on 3000 nodes, and it stops when the picture settles.

import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

import type { LayoutInput } from './layout-weights';

// Iterations for each frame: a batch of 6 costs a few ms at 3000 nodes with the Barnes-Hut tree.
const STEP = 6;
// The run stops after this many frames, settled or not, so a graph that never rests still ends.
const MAX_FRAMES = 240;
// The run stops when the mean move of a node in one batch falls under this share of the picture.
const SETTLED = 0.0004;

const SETTINGS = {
  // Edge weight is the distance rule: a heavier link pulls closer.
  edgeWeightInfluence: 1,
  // Log-linear attraction spreads hubs apart and keeps clusters tight, which shows groups.
  linLogMode: true,
  barnesHutOptimize: true,
  // A hub of thousands of leaves then pulls each leaf less, so it stays a cluster, not a pole.
  outboundAttractionDistribution: true,
  gravity: 0.5,
  scalingRatio: 40,
  slowDown: 4,
} as const;

interface Point {
  x: number;
  y: number;
}

export interface LiveLayout {
  /** Starts a run for these nodes and links, from the places they hold now. */
  readonly run: (input: LayoutInput) => void;
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

  const paint = (nodes: readonly string[]): void => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
      const at = placeOf(node);
      minX = Math.min(minX, at.x);
      maxX = Math.max(maxX, at.x);
      minY = Math.min(minY, at.y);
      maxY = Math.max(maxY, at.y);
    }
    // One scale for both axes, so the picture keeps its shape.
    const scale = frame.span / Math.max(maxX - minX, maxY - minY, Number.EPSILON);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    for (const node of nodes) {
      const at = placeOf(node);
      write(node, {
        x: frame.cx + (at.x - midX) * scale,
        y: frame.cy + (at.y - midY) * scale,
      });
    }
  };

  const run = (input: LayoutInput): void => {
    stop();
    const { nodes, links } = input;
    if (nodes.length === 0) {
      return;
    }
    const graph = new Graph({ type: 'undirected', multi: false });
    const near = new Map<string, string[]>();
    for (const { source, target } of links) {
      near.set(source, [...(near.get(source) ?? []), target]);
      near.set(target, [...(near.get(target) ?? []), source]);
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

    let frames = 0;
    const tick = (): void => {
      handle = 0;
      const moved = forceAtlas2(graph, {
        iterations: STEP,
        settings: SETTINGS,
        getEdgeWeight: 'weight',
      });
      let travel = 0;
      for (const node of nodes) {
        const next = moved[node] ?? placeOf(node);
        const before = raw.get(node);
        if (before !== undefined) travel += Math.hypot(next.x - before.x, next.y - before.y);
        raw.set(node, next);
        graph.mergeNodeAttributes(node, next);
      }
      paint(nodes);
      step();
      frames += 1;
      const span = Math.max(
        ...nodes.map((node) => Math.abs(placeOf(node).x)),
        ...nodes.map((node) => Math.abs(placeOf(node).y)),
        Number.EPSILON,
      );
      if (frames >= MAX_FRAMES || travel / nodes.length / span < SETTLED) {
        return;
      }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
  };

  return { run, stop };
}
