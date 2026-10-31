import { describe, expect, it } from 'vitest';
import { asciiRows } from './ascii-art';

describe('asciiRows', () => {
  it('leaves the median ground blank and inks the distance from it', () => {
    expect(asciiRows([0.5, 0.5, 0.5, 0.1], 2)).toEqual(['  ', ' @']);
    expect(asciiRows([0.5, 0.5, 0.5, 0.6], 2)).toEqual(['  ', ' :']);
  });
});
