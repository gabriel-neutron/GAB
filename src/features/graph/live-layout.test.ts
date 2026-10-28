import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLiveLayout } from './live-layout';

const FRAME = { cx: 0, cy: 0, span: 1 };
let queue: (() => void)[] = [];

beforeEach(() => {
  queue = [];
  vi.stubGlobal('requestAnimationFrame', (run: () => void) => queue.push(run));
  vi.stubGlobal('cancelAnimationFrame', () => {
    queue = [];
  });
});
afterEach(() => vi.unstubAllGlobals());

const drain = (limit: number): number => {
  let frames = 0;
  while (queue.length > 0 && frames < limit) {
    queue.shift()?.();
    frames += 1;
  }
  return frames;
};

const input = {
  nodes: ['a', 'b', 'c'],
  links: [
    { source: 'a', target: 'b', weight: 3 },
    { source: 'b', target: 'c', weight: 1 },
  ],
};

describe('the live layout', () => {
  it('ends after a bounded count of frames', () => {
    const live = createLiveLayout(new Map(), FRAME, vi.fn(), vi.fn());
    live.run(input);
    expect(drain(1000)).toBeLessThanOrEqual(120);
    expect(queue).toHaveLength(0);
  });

  it('draws nothing after stop', () => {
    const step = vi.fn();
    const live = createLiveLayout(new Map(), FRAME, vi.fn(), step);
    live.run(input);
    live.stop();
    drain(10);
    expect(step).not.toHaveBeenCalled();
  });

  it('puts a returning node near its neighbours', () => {
    const raw = new Map([
      ['a', { x: 50, y: 50 }],
      ['b', { x: 50, y: 50 }],
    ]);
    const live = createLiveLayout(raw, FRAME, vi.fn(), vi.fn());
    live.run({ nodes: ['a', 'b'], links: [] });
    drain(1);
    live.run({ nodes: ['a', 'b', 'c'], links: [{ source: 'c', target: 'a', weight: 1 }] });
    const at = raw.get('c');
    expect(Math.abs((at?.x ?? 0) - (raw.get('a')?.x ?? 99))).toBeLessThan(1);
    live.stop();
  });
});
