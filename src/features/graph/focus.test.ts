import { describe, expect, it } from 'vitest';

import { layoutFocus } from './focus';

const EDGES: Readonly<Record<string, readonly string[]>> = {
  vessel: ['owner', 'flag', 'manager'],
  owner: ['vessel', 'parent'],
  flag: ['vessel'],
  manager: ['vessel', 'parent'],
  parent: ['owner', 'manager', 'far'],
  far: ['parent'],
};

const neighbours = (id: string): readonly string[] => EDGES[id] ?? [];

describe('the layout of a focus', () => {
  it('draws the centre and its neighbours at one hop, and nothing else', () => {
    const layout = layoutFocus({ centre: 'vessel', hops: 1, expanded: [], neighbours });

    expect([...layout.offsets.keys()].sort()).toEqual(['flag', 'manager', 'owner', 'vessel']);
    expect(layout.offsets.get('vessel')).toEqual({ x: 0, y: 0 });
  });

  it('adds the neighbours of the neighbours at two hops, and no third hop', () => {
    const layout = layoutFocus({ centre: 'vessel', hops: 2, expanded: [], neighbours });

    expect(layout.offsets.has('parent')).toBe(true);
    expect(layout.offsets.has('far')).toBe(false);
  });

  it('puts the neighbours at one distance from the centre, apart from each other', () => {
    const layout = layoutFocus({ centre: 'vessel', hops: 1, expanded: [], neighbours });
    const ring = ['owner', 'flag', 'manager'].map((id) => layout.offsets.get(id));

    for (const point of ring) expect(Math.hypot(point?.x ?? 0, point?.y ?? 0)).toBeCloseTo(1);
    expect(new Set(ring.map((point) => `${String(point?.x)}|${String(point?.y)}`)).size).toBe(3);
  });

  it('gives the same layout for the same input', () => {
    const one = layoutFocus({ centre: 'vessel', hops: 2, expanded: [], neighbours });
    const two = layoutFocus({ centre: 'vessel', hops: 2, expanded: [], neighbours });

    expect([...two.offsets]).toEqual([...one.offsets]);
  });

  it('keeps the place of a node when another node is expanded', () => {
    const before = layoutFocus({ centre: 'vessel', hops: 1, expanded: [], neighbours });
    const after = layoutFocus({ centre: 'vessel', hops: 1, expanded: ['owner'], neighbours });

    expect(after.offsets.has('parent')).toBe(true);
    for (const [id, point] of before.offsets) expect(after.offsets.get(id)).toEqual(point);
  });

  it('draws a centre with no neighbour alone', () => {
    const layout = layoutFocus({ centre: 'lone', hops: 2, expanded: [], neighbours });

    expect([...layout.offsets.keys()]).toEqual(['lone']);
  });

  it('counts the hops of the nodes it draws', () => {
    const layout = layoutFocus({ centre: 'vessel', hops: 2, expanded: [], neighbours });

    expect(layout.hopOf.get('vessel')).toBe(0);
    expect(layout.hopOf.get('owner')).toBe(1);
    expect(layout.hopOf.get('parent')).toBe(2);
  });
});
