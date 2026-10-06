import { describe, expect, it } from 'vitest';

import type { Relation } from '@/shared/read/model';

import { unitHierarchy } from './fold-subordinates';

const subordinate = (child: string, parent: string, type = 'subordinate_to'): Relation => ({
  id: `${child}-${type}-${parent}`,
  type,
  proposedType: null,
  srcKind: 'entity',
  srcId: child,
  dstKind: 'entity',
  dstId: parent,
  attrs: {},
  sources: [],
  validFrom: null,
  validTo: null,
  promotedFrom: `${child}-${parent}`,
});

const relations: readonly Relation[] = [
  subordinate('b', 'a'),
  subordinate('c', 'a'),
  subordinate('d', 'b'),
  subordinate('e', 'd'),
  subordinate('f', 'a'),
  subordinate('f', 'g'),
  subordinate('r2', 'r1'),
  subordinate('r1', 'r2'),
  subordinate('x', 'a', 'located_at'),
  subordinate('b', 'absent'),
];

const drawn = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'r1', 'r2', 'x']);
const hierarchy = unitHierarchy(relations, drawn);
const none: ReadonlySet<string> = new Set();

const sorted = (set: ReadonlySet<string>): readonly string[] =>
  [...set].sort((one, two) => one.localeCompare(two));

describe('the subordinates of a unit', () => {
  it('reads the subordinate from the source and the parent from the target', () => {
    expect(hierarchy.subordinatesOf('a')).toEqual(['b', 'c', 'f']);
    expect(hierarchy.subordinatesOf('b')).toEqual(['d']);
    expect(hierarchy.subordinatesOf('e')).toEqual([]);
  });

  it('folds every subordinate while no unit is open', () => {
    expect(sorted(hierarchy.foldedUnder(none))).toEqual(['b', 'c', 'd', 'e', 'f', 'r2']);
  });

  it('opens one level, and not the whole tree below the unit', () => {
    expect(sorted(hierarchy.foldedUnder(new Set(['a'])))).toEqual(['d', 'e', 'r2']);
  });

  it('draws a subordinate of two parents while either one is open', () => {
    expect(hierarchy.foldedUnder(new Set(['g'])).has('f')).toBe(false);
  });

  it('never folds the whole of a ring that has no top', () => {
    expect(hierarchy.foldedUnder(none).has('r1')).toBe(false);
    expect(hierarchy.foldedUnder(new Set(['r1'])).has('r2')).toBe(false);
  });

  it('ignores another relation type and an end that is not drawn', () => {
    expect(hierarchy.foldedUnder(none).has('x')).toBe(false);
    expect(hierarchy.subordinatesOf('absent')).toEqual([]);
  });
});

describe('the close of a unit', () => {
  it('closes each open unit that it folds, so the next open shows one level', () => {
    const open = hierarchy.closing(new Set(['a', 'b', 'g']), 'a');

    expect(sorted(open)).toEqual(['g']);
    expect(sorted(hierarchy.foldedUnder(new Set([...open, 'a'])))).toEqual(['d', 'e', 'r2']);
  });

  it('keeps an open unit that another open parent still draws', () => {
    const open = hierarchy.closing(new Set(['a', 'g', 'f']), 'a');

    expect(sorted(open)).toEqual(['f', 'g']);
  });
});

describe('the reveal of a folded entity', () => {
  it('opens each unit on the path from a drawn unit down to the entity', () => {
    const open = hierarchy.revealing(none, 'e');

    expect(sorted(open)).toEqual(['a', 'b', 'd']);
    expect(hierarchy.foldedUnder(open).has('e')).toBe(false);
  });

  it('gives back the same set for an entity that is already drawn', () => {
    const open = new Set(['a']);

    expect(hierarchy.revealing(open, 'b')).toBe(open);
    expect(hierarchy.revealing(open, 'g')).toBe(open);
  });
});

describe('a ring of subordinates in bad source data', () => {
  const ring = unitHierarchy(
    [
      subordinate('k', 'm'),
      subordinate('m', 'l'),
      subordinate('l', 'k'),
      subordinate('n', 'k'),
      subordinate('p', 'q'),
      subordinate('q', 'p'),
      subordinate('p', 'top'),
    ],
    new Set(['k', 'l', 'm', 'n', 'p', 'q', 'top']),
  );

  it('stands the first member in the order of identifiers as the top of the ring', () => {
    expect(sorted(ring.foldedUnder(none))).toEqual(['l', 'm', 'n', 'p', 'q']);
    expect(ring.nested(['m', 'l', 'k'], none).map((row) => row.id)).toEqual(['k']);
  });

  it('opens the ring down from that top, one level at a time', () => {
    expect(sorted(ring.foldedUnder(new Set(['k'])))).toEqual(['m', 'p', 'q']);
    expect(ring.foldedUnder(new Set(['k', 'l'])).has('m')).toBe(false);
  });

  it('gives no ring a top of its own where a real top reaches it', () => {
    expect(ring.foldedUnder(new Set(['top'])).has('p')).toBe(false);
    expect(ring.foldedUnder(new Set(['top'])).has('q')).toBe(true);
  });

  it('reveals a member of the ring from its top', () => {
    const open = ring.revealing(none, 'm');

    expect(sorted(open)).toEqual(['k', 'l']);
    expect(ring.foldedUnder(open).has('m')).toBe(false);
  });
});

const members = ['g', 'a', 'c', 'b', 'f', 'd', 'e', 'x'];

const linesOf = (open: ReadonlySet<string>): readonly string[] =>
  hierarchy.nested(members, open).map((row) => `${'.'.repeat(row.depth)}${row.id}`);

describe('the folder list of one section', () => {
  it('lists the tops alone while no unit is open, in the order of the caller', () => {
    expect(linesOf(none)).toEqual(['g', 'a', 'x']);
  });

  it('puts the subordinates of an open unit one level under it, in the order of the caller', () => {
    expect(linesOf(new Set(['a']))).toEqual(['g', 'a', '.c', '.b', '.f', 'x']);
  });

  it('nests one level deeper for each open unit on the way down', () => {
    expect(linesOf(new Set(['a', 'b', 'd']))).toEqual([
      'g',
      'a',
      '.c',
      '.b',
      '..d',
      '...e',
      '.f',
      'x',
    ]);
  });

  it('lists a subordinate of two open parents once, under the first one', () => {
    expect(linesOf(new Set(['g', 'a']))).toEqual(['g', '.f', 'a', '.c', '.b', 'x']);
  });

  it('says how many subordinates a line holds and whether it is open', () => {
    const [top] = hierarchy.nested(['a'], new Set(['a']));

    expect(top).toEqual({ id: 'a', depth: 0, subordinates: 3, open: true });
  });

  it('lists every member on one level for a search, the folded ones too', () => {
    expect(hierarchy.listed(['e', 'a'], none).map((row) => [row.id, row.depth])).toEqual([
      ['e', 0],
      ['a', 0],
    ]);
  });
});
