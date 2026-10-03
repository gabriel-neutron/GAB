import { describe, expect, it } from 'vitest';

import type { GeoEntity } from './projection';
import { spreadOffsetPx, spreadSlots } from './spread';

const HUB = { lon: 40.0, lat: 47.0 };
const ELSEWHERE = { lon: 41.5, lat: 48.5 };

const entity = (
  id: string,
  label: string,
  point: { readonly lon: number; readonly lat: number },
  parentId: string | null,
): GeoEntity => ({
  fid: 0,
  id,
  type: 'military_unit',
  label,
  lon: point.lon,
  lat: point.lat,
  sources: [],
  attrs: {},
  parentId,
  positionFrom: null,
  symbol: null,
});

describe('the circle a shared point spreads its entities into', () => {
  it('gives no slot to an entity that stands alone at its point', () => {
    const slots = spreadSlots([entity('a', 'Alone', ELSEWHERE, null)]);

    expect(slots.size).toBe(0);
  });

  it('gives no slot to the ancestor that lent its point, and one to each borrower', () => {
    const parent = entity('parent', 'Corps', HUB, null);
    const first = entity('first', 'Alpha Battalion', HUB, 'parent');
    const second = entity('second', 'Bravo Battalion', HUB, 'parent');
    const slots = spreadSlots([parent, first, second]);

    expect(slots.has('parent')).toBe(false);
    expect(slots.get('first')).toEqual({ order: 0, count: 2 });
    expect(slots.get('second')).toEqual({ order: 1, count: 2 });
  });

  it('spreads every borrower when the point draws no ancestor of its own', () => {
    const first = entity('first', 'Alpha Battalion', HUB, 'absent-parent');
    const second = entity('second', 'Bravo Battalion', HUB, 'absent-parent');
    const slots = spreadSlots([first, second]);

    expect(slots.get('first')).toEqual({ order: 0, count: 2 });
    expect(slots.get('second')).toEqual({ order: 1, count: 2 });
  });

  it('orders borrowers by label, so the circle stands the same way at every render', () => {
    const zulu = entity('z', 'Zulu Battalion', HUB, 'parent');
    const alpha = entity('a', 'Alpha Battalion', HUB, 'parent');
    const slots = spreadSlots([zulu, alpha]);

    expect(slots.get('a')).toEqual({ order: 0, count: 2 });
    expect(slots.get('z')).toEqual({ order: 1, count: 2 });
  });

  it('leaves an entity at a point it shares with nobody out of every slot', () => {
    const shared = entity('shared-1', 'Shared', HUB, 'parent');
    const sharedToo = entity('shared-2', 'Shared too', HUB, 'parent');
    const lone = entity('lone', 'Alone elsewhere', ELSEWHERE, 'another-parent');
    const slots = spreadSlots([shared, sharedToo, lone]);

    expect(slots.has('lone')).toBe(false);
    expect(slots.size).toBe(2);
  });
});

describe('the pixel offset of one slot in the circle', () => {
  it('puts the first of one at the top, radius pixels above the centre', () => {
    const { dx, dy } = spreadOffsetPx({ order: 0, count: 1 }, 20);

    expect(dx).toBeCloseTo(0);
    expect(dy).toBeCloseTo(-20);
  });

  it('spaces every slot of a circle the same distance from the centre', () => {
    const count = 5;
    for (let order = 0; order < count; order += 1) {
      const { dx, dy } = spreadOffsetPx({ order, count }, 15);
      expect(Math.hypot(dx, dy)).toBeCloseTo(15);
    }
  });
});
