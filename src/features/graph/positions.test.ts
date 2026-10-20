import { describe, expect, it } from 'vitest';

import type { Entity, EntityPosition } from '@/shared/read/model';

import { graphPositions, type PlacementLink } from './positions';

const entity = (id: string): Entity => ({
  id,
  type: 'vessel',
  proposedType: null,
  label: id,
  attrs: {},
  sources: [],
  geom: null,
  promotedFrom: 'p',
});

const link = (srcId: string, dstId: string): PlacementLink => ({
  srcKind: 'entity',
  srcId,
  dstKind: 'entity',
  dstId,
});

const STORED: ReadonlyMap<string, EntityPosition> = new Map([
  ['a', { x: 10, y: 0 }],
  ['b', { x: 20, y: 0 }],
]);

describe('the places of the graph', () => {
  it('keeps the stored place of an entity the layout run placed', () => {
    const { positions, unplaced } = graphPositions([entity('a'), entity('b')], STORED, []);

    expect(positions.get('a')).toEqual({ x: 10, y: 0 });
    expect(unplaced.size).toBe(0);
  });

  it('places a new entity near its placed neighbours, and not on the ring', () => {
    const { positions, unplaced } = graphPositions(
      [entity('a'), entity('b'), entity('n')],
      STORED,
      [link('n', 'a'), link('b', 'n')],
    );
    const at = positions.get('n');

    expect(unplaced.has('n')).toBe(false);
    expect(at).toBeDefined();
    expect(Math.hypot((at?.x ?? 0) - 15, at?.y ?? 0)).toBeLessThan(2);
  });

  it('puts a new entity with no placed neighbour on the ring and marks it', () => {
    const { positions, unplaced } = graphPositions(
      [entity('a'), entity('b'), entity('n'), entity('m')],
      STORED,
      [link('n', 'm')],
    );

    expect([...unplaced].sort()).toEqual(['m', 'n']);
    expect(Math.hypot(positions.get('n')?.x ?? 0, positions.get('n')?.y ?? 0)).toBeGreaterThan(20);
  });

  it('ignores a relation that has a relation at one end', () => {
    const { unplaced } = graphPositions([entity('a'), entity('n')], STORED, [
      { srcKind: 'relation', srcId: 'a', dstKind: 'entity', dstId: 'n' },
    ]);

    expect(unplaced.has('n')).toBe(true);
  });

  it('keeps a new entity whose only neighbour is also new on the ring', () => {
    const { unplaced } = graphPositions([entity('a'), entity('n'), entity('m')], STORED, [
      link('a', 'n'),
      link('n', 'm'),
    ]);

    expect(unplaced.has('n')).toBe(false);
    expect(unplaced.has('m')).toBe(true);
  });

  it('gives the same place on every call', () => {
    const run = () =>
      graphPositions([entity('a'), entity('n')], STORED, [link('n', 'a')]).positions.get('n');

    expect(run()).toEqual(run());
  });
});
