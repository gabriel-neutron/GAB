import { expect, test } from 'vitest';

import { entityLayout, type LayoutLink } from './layout.ts';

// entityLayout never promises one exact coordinate, because a relaxation and a spiral pack are
// both iterative. It promises one position per entity, every id placed, and a repeatable run.

const link = (source: string, target: string): LayoutLink => ({ source, target });

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

test('the run is deterministic: the same entities and relations give the same picture', () => {
  const entities = ['a', 'b', 'c', 'd', 'e'];
  const links = [link('a', 'b'), link('b', 'c'), link('d', 'e')];
  expect(entityLayout(entities, links)).toEqual(entityLayout(entities, links));
});

test('the largest component is centred on the origin', () => {
  const placed = entityLayout(['a', 'b', 'c', 'lone'], [link('a', 'b'), link('b', 'c')]);
  const byId = new Map(placed.map((position) => [position.id, position]));
  const group = ['a', 'b', 'c'].map((id) => byId.get(id));
  const middleX = group.reduce((total, position) => total + (position?.x ?? 0), 0) / group.length;
  const middleY = group.reduce((total, position) => total + (position?.y ?? 0), 0) / group.length;

  expect(middleX).toBeCloseTo(0, 5);
  expect(middleY).toBeCloseTo(0, 5);
});

test('a tie between components of one size goes to the one that holds the earlier node', () => {
  // Both `b` and `a` stand alone. `b` comes first in the entity list, so it holds the earlier
  // node and its singleton component is centred on the origin.
  const placed = entityLayout(['b', 'a'], []);
  const byId = new Map(placed.map((position) => [position.id, position]));
  expect(byId.get('b')).toEqual({ id: 'b', x: 0, y: 0 });
});

test('two components never land on the same point', () => {
  const placed = entityLayout(['a', 'b', 'c', 'd'], [link('a', 'b')]);
  const points = placed.map((position) => `${position.x},${position.y}`);
  expect(new Set(points).size).toBe(points.length);
});

test('the discs of two components never overlap, over many components of one size', () => {
  const lone = Array.from({ length: 30 }, (_unused, index) => `lone-${index}`);
  const pairs = Array.from({ length: 5 }, (_unused, index): readonly [string, string] => [
    `pair-${index}-a`,
    `pair-${index}-b`,
  ]);
  const componentOf = new Map([
    ...lone.map((id): [string, string] => [id, id]),
    ...pairs.flatMap(([a, b]): [string, string][] => [
      [a, a],
      [b, a],
    ]),
  ]);
  const placed = entityLayout(
    [...lone, ...pairs.flat()],
    pairs.map(([a, b]) => link(a, b)),
  );

  // Origin: each entity stands half the spacing of 24 inside the disc of its component, and a gap
  // of 16 parts two discs, so two entities of different components stand 24 + 16 apart or more.
  const least = 24 + 16 - 1e-6;
  const crowded = placed.flatMap((one, index) =>
    placed
      .slice(index + 1)
      .filter((two) => componentOf.get(one.id) !== componentOf.get(two.id))
      .filter((two) => Math.hypot(one.x - two.x, one.y - two.y) < least)
      .map((two) => `${one.id} ${two.id}`),
  );

  expect(placed).toHaveLength(40);
  expect(crowded).toEqual([]);
});

test('an entity connected to the rest sits closer to its neighbour than an unconnected one', () => {
  const placed = entityLayout(['a', 'b', 'far'], [link('a', 'b')]);
  const byId = new Map(placed.map((position) => [position.id, position]));
  const a = byId.get('a');
  const b = byId.get('b');
  const far = byId.get('far');
  const distance = (one?: { x: number; y: number }, two?: { x: number; y: number }): number =>
    Math.hypot((one?.x ?? 0) - (two?.x ?? 0), (one?.y ?? 0) - (two?.y ?? 0));

  expect(distance(a, b)).toBeLessThan(distance(a, far));
  expect(distance(a, b)).toBeLessThan(distance(b, far));
});
