import { describe, expect, it } from 'vitest';

import { edgeLabelPlace, spreadDown } from './focus-labels';

describe('the vertical spread of the names on one side', () => {
  it('keeps two names that stand apart where they are', () => {
    const spread = spreadDown(
      [
        { id: 'a', y: 10 },
        { id: 'b', y: 60 },
      ],
      16,
    );

    expect(spread.get('a')).toBe(10);
    expect(spread.get('b')).toBe(60);
  });

  it('pushes a name down when it stands too near the name above', () => {
    const spread = spreadDown(
      [
        { id: 'b', y: 14 },
        { id: 'a', y: 10 },
      ],
      16,
    );

    expect(spread.get('a')).toBe(10);
    expect(spread.get('b')).toBe(26);
  });
});

describe('the place of the label of a relation', () => {
  it('stands beside the middle of the line, above it', () => {
    const place = edgeLabelPlace({ x: 0, y: 0 }, { x: 100, y: 0 }, 0, 1);

    expect(place.x).toBeCloseTo(50);
    expect(place.y).toBeLessThan(0);
    expect(place.y).toBeGreaterThan(-20);
    expect(place.angle).toBeCloseTo(0);
  });

  it('turns the text so that it is never upside down', () => {
    const place = edgeLabelPlace({ x: 100, y: 0 }, { x: 0, y: 0 }, 0, 1);

    expect(place.angle).toBeCloseTo(0);
  });

  it('separates parallel relations across the line', () => {
    const first = edgeLabelPlace({ x: 0, y: 0 }, { x: 100, y: 0 }, 0, 2);
    const second = edgeLabelPlace({ x: 0, y: 0 }, { x: 100, y: 0 }, 1, 2);

    expect(Math.abs(first.y - second.y)).toBeGreaterThan(10);
  });
});
