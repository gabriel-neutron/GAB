import { describe, expect, it } from 'vitest';
import { countsAt } from './timeline-counts';

describe('countsAt', () => {
  it('counts no tanker before the first designation', () => {
    expect(countsAt('2014-03-17')).toEqual({ EU: 0, UK: 0, OFAC: 0 });
  });

  it('adds the quarters of each regime to the end of the quarter of the date', () => {
    // To 2024-Q2: OFAC 1 + 2 + 5 + 3 + 2 + 9 + 32 + 7, EU 18, UK none yet.
    expect(countsAt('2024-04-01')).toEqual({ EU: 18, UK: 0, OFAC: 61 });
    expect(countsAt('2024-06-30')).toEqual(countsAt('2024-04-01'));
  });

  it('gives the total of each regime after the last quarter', () => {
    expect(countsAt('2027-01-01')).toEqual({ EU: 649, UK: 627, OFAC: 235 });
  });
});
