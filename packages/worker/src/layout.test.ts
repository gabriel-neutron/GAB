import { expect, test } from 'vitest';

import { entityLayout, type LayoutLink, type LayoutPosition } from './layout.ts';

// The layout promises no exact coordinate. It promises one position per entity, a repeatable run,
// related entities near each other, and no two entities on one point.

const link = (source: string, target: string): LayoutLink => ({ source, target });

const distance = (one: LayoutPosition, two: LayoutPosition): number =>
  Math.hypot(one.x - two.x, one.y - two.y);

const placedById = (placed: readonly LayoutPosition[]): ((id: string) => LayoutPosition) => {
  const byId = new Map(placed.map((position) => [position.id, position]));
  return (id) => {
    const found = byId.get(id);
    if (found === undefined) throw new Error(`the layout placed no ${id}`);
    return found;
  };
};

test('every entity given gets exactly one position, and no other id appears', () => {
  const placed = entityLayout(['a', 'b', 'c'], [link('a', 'b')]);
  expect(placed.map((position) => position.id).sort()).toEqual(['a', 'b', 'c']);
});

test('an entity repeated in the list is placed once', () => {
  const placed = entityLayout(['a', 'a', 'b'], []);
  expect(placed.map((position) => position.id).sort()).toEqual(['a', 'b']);
});

test('no entities gives no positions', () => {
  expect(entityLayout([], [])).toEqual([]);
});

test('a self-loop joins no neighbour, so it changes nothing about the layout', () => {
  const withLoop = entityLayout(['a', 'b'], [link('a', 'a'), link('a', 'b')]);
  const withoutLoop = entityLayout(['a', 'b'], [link('a', 'b')]);
  expect(withLoop).toEqual(withoutLoop);
});

test('a link with an end that no entity carries joins nothing that is drawn', () => {
  const withDangling = entityLayout(['a', 'b'], [link('a', 'x')]);
  const withNoLink = entityLayout(['a', 'b'], []);
  expect(withDangling).toEqual(withNoLink);
});

test('a link reads either end as the same relation', () => {
  const forward = entityLayout(['a', 'b', 'c'], [link('a', 'b')]);
  const reversed = entityLayout(['a', 'b', 'c'], [link('b', 'a')]);
  expect(forward).toEqual(reversed);
});

test('two relations between one pair weigh as one', () => {
  const once = entityLayout(['a', 'b', 'c'], [link('a', 'b')]);
  const twice = entityLayout(['a', 'b', 'c'], [link('a', 'b'), link('b', 'a')]);
  expect(twice).toEqual(once);
});

test('the run is deterministic: the same entities and relations give the same picture', () => {
  const entities = ['a', 'b', 'c', 'd', 'e'];
  const links = [link('a', 'b'), link('b', 'c'), link('d', 'e')];
  expect(entityLayout(entities, links)).toEqual(entityLayout(entities, links));
});

test('each position is a finite number', () => {
  const placed = entityLayout(['lone'], []);
  expect(placed).toHaveLength(1);
  for (const position of placed) {
    expect(Number.isFinite(position.x)).toBe(true);
    expect(Number.isFinite(position.y)).toBe(true);
  }
});

test('no two entities land on one point, over many components', () => {
  const lone = Array.from({ length: 30 }, (_unused, index) => `lone-${String(index)}`);
  const pairs = Array.from({ length: 5 }, (_unused, index) => [
    `pair-${String(index)}-a`,
    `pair-${String(index)}-b`,
  ]);
  const placed = entityLayout(
    [...lone, ...pairs.flat()],
    pairs.map(([a = '', b = '']) => link(a, b)),
  );
  const points = placed.map((position) => `${position.x.toFixed(3)},${position.y.toFixed(3)}`);
  expect(placed).toHaveLength(40);
  expect(new Set(points).size).toBe(points.length);
});

test('an entity connected to the rest sits closer to its neighbour than an unconnected one', () => {
  const at = placedById(entityLayout(['a', 'b', 'far'], [link('a', 'b')]));
  expect(distance(at('a'), at('b'))).toBeLessThan(distance(at('a'), at('far')));
  expect(distance(at('a'), at('b'))).toBeLessThan(distance(at('b'), at('far')));
});

test('in a chain, each entity sits closer to its neighbour than to the far end', () => {
  const at = placedById(
    entityLayout(
      ['a', 'b', 'c', 'd', 'e'],
      [link('a', 'b'), link('b', 'c'), link('c', 'd'), link('d', 'e')],
    ),
  );
  expect(distance(at('a'), at('b'))).toBeLessThan(distance(at('a'), at('e')));
  expect(distance(at('d'), at('e'))).toBeLessThan(distance(at('a'), at('e')));
});
