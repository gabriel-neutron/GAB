import { describe, expect, it } from 'vitest';

import { keptNames } from './name-overlap';

const box = (x: number, y: number) => ({ x, y, width: 50, height: 10 });

describe('keptNames', () => {
  it('keeps names that do not meet', () => {
    expect(keptNames([box(0, 0), box(60, 0), box(0, 20)])).toEqual([true, true, true]);
  });

  it('drops the lower rank of two names that meet', () => {
    expect(keptNames([box(0, 0), box(40, 5)])).toEqual([true, false]);
  });

  it('lets a dropped name free the room for a later one', () => {
    expect(keptNames([box(0, 0), box(40, 5), box(80, 0)])).toEqual([true, false, true]);
  });

  it('drops a name with no place', () => {
    expect(keptNames([null, box(0, 0)])).toEqual([false, true]);
  });

  it('keeps names that only touch at an edge', () => {
    expect(keptNames([box(0, 0), box(50, 0)])).toEqual([true, true]);
  });
});
