import type { ChainStep } from '@gab/proposal/chain-steps';
import { describe, expect, it } from 'vitest';

import { revealOf, waveProgress } from './chain-reveal';

const step = (key: string, assets: string[], arcs: string[] = []): ChainStep => ({
  key,
  label: key,
  stage: 'field',
  count: assets.length,
  sentence: '',
  assets,
  arcs,
  exits: [],
});
const steps = [step('a', ['a1']), step('b', ['b1'], ['l1']), step('c', ['c1'], ['l2'])];
const all = { assets: ['a1', 'b1', 'c1', 'x1'], arcs: ['l1', 'l2', 'review'], exits: [] };

describe('revealOf', () => {
  it('gives null when no step is in view, so the globe shows everything', () => {
    expect(revealOf(steps, null, all)).toBeNull();
    expect(revealOf(steps, 'nope', all)).toBeNull();
  });

  it('draws the earlier steps in full, brings the step in, and hides the later steps', () => {
    const reveal = revealOf(steps, 'b', all);
    expect(reveal?.done.assets).toEqual(['a1']);
    expect(reveal?.entering).toEqual({ assets: ['b1'], arcs: ['l1'], exits: [] });
    expect(reveal?.hidden).toEqual({
      assets: ['c1', 'x1'],
      arcs: ['l2', 'review'],
      exits: [],
    });
  });

  it('keeps a feature that no step holds out of sight, and has nothing done at the first step', () => {
    expect(revealOf(steps, 'c', all)?.hidden.assets).toEqual(['x1']);
    expect(revealOf(steps, 'a', all)?.done.assets).toEqual([]);
  });
});

describe('waveProgress', () => {
  it('starts the first feature at once and ends every feature when the group ends', () => {
    expect(waveProgress(0, 0, 5, 0.6)).toBe(0);
    expect(waveProgress(0.2, 0, 5, 0.6)).toBeGreaterThan(0);
    for (const rank of [0, 2, 4]) expect(waveProgress(1, rank, 5, 0.6)).toBe(1);
  });

  it('starts a later feature later', () => {
    expect(waveProgress(0.3, 4, 5, 0.6)).toBe(0);
    expect(waveProgress(0.3, 1, 5, 0.6)).toBeGreaterThan(0);
  });

  it('gives the full progress for a group of one', () => {
    expect(waveProgress(1, 0, 1, 0.6)).toBe(1);
  });
});
