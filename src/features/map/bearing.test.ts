import { describe, expect, it } from 'vitest';

import { planeBearing } from './bearing';

describe('the bearing of the head of a relation line', () => {
  it('points east and north along the axes', () => {
    expect(planeBearing({ lon: 30, lat: 60 }, { lon: 31, lat: 60 })).toBeCloseTo(90);
    expect(planeBearing({ lon: 30, lat: 60 }, { lon: 30, lat: 61 })).toBeCloseTo(0);
  });

  it('follows the line the Mercator map draws at a high latitude', () => {
    // From 55 N to 56 N the Mercator y grows by about 1.77 degrees for one degree of longitude.
    const angle = planeBearing({ lon: 37, lat: 55 }, { lon: 38, lat: 56 });

    expect(angle).toBeGreaterThan(29);
    expect(angle).toBeLessThan(30);
  });
});
