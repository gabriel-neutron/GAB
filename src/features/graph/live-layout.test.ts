import { describe, expect, it, vi } from 'vitest';

import { createLiveLayout, type LayoutEngine } from './live-layout';
import type { InMessage } from './layout-worker';

const FRAME = { cx: 0, cy: 0, span: 1 };
const FORCES = {
  linLogMode: true,
  strongGravityMode: false,
  gravity: 1,
  scalingRatio: 5,
  outboundAttractionDistribution: false,
};
const NONE = new Map<string, number>();

/** A worker that keeps what it is sent, and answers when the test says so. */
const engineOf = (): LayoutEngine & { readonly sent: InMessage[] } => {
  const sent: InMessage[] = [];
  return {
    sent,
    onmessage: null,
    postMessage: (message) => {
      sent.push(message);
    },
  };
};

describe('the live layout', () => {
  it('sends the nodes and the weighted links to the worker', () => {
    const engine = engineOf();
    const live = createLiveLayout(new Map(), FRAME, vi.fn(), engine);
    live.run(
      {
        nodes: ['a', 'b'],
        rest: [],
        links: [{ source: 'a', target: 'b', weight: 3 }],
        strength: NONE,
      },
      FORCES,
    );
    const run = engine.sent.find((message) => message.type === 'run');
    expect(run?.type === 'run' && run.count).toBe(2);
    expect(run?.type === 'run' && [...run.weights]).toEqual([3]);
  });

  it('paints the answer of the current run and drops the answer of an old run', () => {
    const engine = engineOf();
    const write = vi.fn();
    const live = createLiveLayout(new Map(), FRAME, write, engine);
    const input = { nodes: ['a', 'b'], rest: [], links: [], strength: NONE };
    live.run(input, FORCES);
    const first = engine.sent.at(-1);
    live.run(input, FORCES);
    const second = engine.sent.at(-1);
    write.mockClear();
    const places = new Float64Array([0, 0, 1, 1]);
    const id = (message: InMessage | undefined): number =>
      message?.type === 'run' ? message.id : -1;
    engine.onmessage?.(
      new MessageEvent('message', { data: { id: id(first), places, done: true } }),
    );
    expect(write).not.toHaveBeenCalled();
    engine.onmessage?.(
      new MessageEvent('message', { data: { id: id(second), places, done: true } }),
    );
    expect(write).toHaveBeenCalledOnce();
  });

  it('puts a returning node near its neighbours', () => {
    const raw = new Map([
      ['a', { x: 50, y: 50 }],
      ['b', { x: 50, y: 50 }],
    ]);
    const engine = engineOf();
    const live = createLiveLayout(raw, FRAME, vi.fn(), engine);
    live.run({ nodes: ['a', 'b'], rest: [], links: [], strength: NONE }, FORCES);
    live.run(
      {
        nodes: ['a', 'b', 'c'],
        rest: [],
        links: [{ source: 'c', target: 'a', weight: 1 }],
        strength: NONE,
      },
      FORCES,
    );
    expect(Math.abs((raw.get('c')?.x ?? 0) - 50)).toBeLessThan(1);
  });

  it('gives each node with no link its own place', () => {
    const rest = Array.from({ length: 800 }, (_, index) => `n${String(index)}`);
    const seen = new Set<string>();
    const live = createLiveLayout(
      new Map(),
      FRAME,
      (places) => {
        for (const at of places.values()) seen.add(`${at.x.toFixed(6)},${at.y.toFixed(6)}`);
      },
      engineOf(),
    );
    live.run({ nodes: [], rest, links: [], strength: NONE }, FORCES);
    expect(seen.size).toBe(800);
  });
});
