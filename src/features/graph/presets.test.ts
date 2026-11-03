import { describe, expect, it } from 'vitest';

import { FOCUS_SEEDS, focusOf } from './presets';

const link = (
  source: string,
  target: string,
  family: 'operation' | 'designation' = 'operation',
) => ({ source, target, family });

describe('the focus preset', () => {
  it('keeps the most connected entities and their direct neighbours only', () => {
    // `FOCUS_SEEDS` hubs of three links each, and a far node that no seed touches.
    const hubs = Array.from({ length: FOCUS_SEEDS }, (_, index) => `hub${String(index)}`);
    const links = [
      ...hubs.flatMap((hub) => [link(hub, `${hub}a`), link(hub, `${hub}b`), link(hub, `${hub}c`)]),
      link('hub0a', 'far'),
    ];
    const kept = focusOf(links);
    expect(kept.has('hub0')).toBe(true);
    expect(kept.has('hub0a')).toBe(true);
    expect(kept.has('far')).toBe(false);
  });

  it('ranks the seeds without the links of designation', () => {
    const links = [
      link('act', 'x', 'designation'),
      link('act', 'y', 'designation'),
      link('act', 'z', 'designation'),
      link('owner', 'x'),
    ];
    const kept = focusOf(links);
    // `owner` and `x` hold the only operational link, so each is a seed and `act` is a neighbour.
    expect(kept.has('owner')).toBe(true);
    expect(kept.has('act')).toBe(true);
    expect(kept.has('y')).toBe(false);
  });
});
