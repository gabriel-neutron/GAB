import { describe, expect, it } from 'vitest';

import { RAIL_WIDTH, railWidthWithin } from './rail-width';

describe('the width of the rail', () => {
  it('keeps a width inside the bounds', () => {
    expect(railWidthWithin(300)).toBe(300);
  });

  it('clamps a width outside the bounds to the nearer bound', () => {
    expect(railWidthWithin(20)).toBe(RAIL_WIDTH.min);
    expect(railWidthWithin(4000)).toBe(RAIL_WIDTH.max);
  });

  it('draws the narrowest rail for a width that is not a number', () => {
    expect(railWidthWithin(Number.NaN)).toBe(RAIL_WIDTH.min);
  });
});
