// The force run, off the main thread. The page sends the nodes, their places and the weighted
// links, and the worker answers with the places about 6 times each second, until the picture
// settles. A new `run` or a `stop` ends the run in progress.

import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

import type { ForceSettings } from './variants';

export interface RunMessage {
  readonly type: 'run';
  readonly id: number;
  readonly count: number;
  /** x then y of each node, in the order of the node list. */
  readonly places: Float64Array;
  /** The two ends of each link, as indexes into the node list. */
  readonly ends: Uint32Array;
  readonly weights: Float64Array;
  readonly forces: ForceSettings;
}

export type InMessage = RunMessage | { readonly type: 'stop' };

export interface OutMessage {
  readonly id: number;
  readonly places: Float64Array;
  readonly done: boolean;
}

// Iterations for each batch, and the time that batches may take before the worker posts.
const STEP = 6;
const POST_EVERY_MS = 150;
// The run stops after this many batches, settled or not, so a graph that never rests still ends.
const MAX_BATCHES = 80;
// The run stops when the mean move of a node in one batch falls under this share of the picture.
const SETTLED = 0.0004;

let current = 0;

function run(message: RunMessage): void {
  const { id, count, places, ends, weights, forces } = message;
  const graph = new Graph({ type: 'undirected', multi: false });
  for (let index = 0; index < count; index += 1) {
    graph.addNode(String(index), { x: places[2 * index] ?? 0, y: places[2 * index + 1] ?? 0 });
  }
  for (let link = 0; link < weights.length; link += 1) {
    graph.addEdge(String(ends[2 * link]), String(ends[2 * link + 1]), {
      weight: weights[link] ?? 1,
    });
  }
  const settings = { ...forces, edgeWeightInfluence: 1, barnesHutOptimize: true, slowDown: 4 };
  const out = new Float64Array(places);
  let batches = 0;

  const loop = (): void => {
    if (current !== id) return;
    const started = performance.now();
    let settled: boolean;
    do {
      const moved = forceAtlas2(graph, { iterations: STEP, settings, getEdgeWeight: 'weight' });
      let travel = 0;
      let reach = Number.EPSILON;
      for (let index = 0; index < count; index += 1) {
        const next = moved[String(index)];
        if (next === undefined) continue;
        travel += Math.hypot(next.x - (out[2 * index] ?? 0), next.y - (out[2 * index + 1] ?? 0));
        out[2 * index] = next.x;
        out[2 * index + 1] = next.y;
        reach = Math.max(reach, Math.abs(next.x), Math.abs(next.y));
        graph.mergeNodeAttributes(String(index), next);
      }
      batches += 1;
      settled = travel / Math.max(count, 1) / reach < SETTLED;
    } while (!settled && batches < MAX_BATCHES && performance.now() - started < POST_EVERY_MS);
    const done = settled || batches >= MAX_BATCHES;
    const reply: OutMessage = { id, places: new Float64Array(out), done };
    self.postMessage(reply, [reply.places.buffer]);
    if (!done) setTimeout(loop, 0);
  };
  loop();
}

self.onmessage = (event: MessageEvent<InMessage>) => {
  const message = event.data;
  if (message.type === 'stop') {
    current = 0;
    return;
  }
  current = message.id;
  run(message);
};
