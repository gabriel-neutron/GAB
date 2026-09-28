import { describe, expect, it } from 'vitest';

import { FARTHEST_RATIO, NEAREST_RATIO, restorableCamera } from './camera-bounds';

describe('a stored camera of the graph', () => {
  it('is dropped when its ratio is nearer than the nearest bound', () => {
    expect(restorableCamera({ x: 0.982, y: 0.343, ratio: 0.0140064 })).toBeNull();
  });

  it('is dropped when its ratio is farther than the farthest bound', () => {
    expect(restorableCamera({ x: 0.5, y: 0.5, ratio: FARTHEST_RATIO * 2 })).toBeNull();
  });

  it('is kept at each bound and between the bounds', () => {
    const inside = [NEAREST_RATIO, 0.4, 1, FARTHEST_RATIO].map((ratio) => ({
      x: 0.5,
      y: 0.5,
      ratio,
    }));
    for (const camera of inside) expect(restorableCamera(camera)).toBe(camera);
  });

  it('stays absent when no camera is stored', () => {
    expect(restorableCamera(null)).toBeNull();
  });
});
