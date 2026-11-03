import { describe, expect, it } from 'vitest';

import { focusOf } from './presets';

const link = (source: string, target: string, family: 'operation' | 'designation' = 'operation') => ({
  source,
  target,
  family,
});

describe('the focus preset', () => {
  it('keeps the most connected entity and its direct neighbours', () => {
    const links = [link('hub', 'a'), link('hub', 'b'), link('hub', 'c'), link('c', 'far')];
    expect(focusOf(links, new Set(['hub']))).toEqual(new Set(['hub', 'a', 'b', 'c']));
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
  });

  it('keeps a key that a release names, whatever its degree', () => {
    const links = [link('hub', 'a'), link('hub', 'b'), link('key', 'k1')];
    expect(focusOf(links, new Set(['key']))).toEqual(new Set(['key', 'k1']));
  });
});
