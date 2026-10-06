import { describe, expect, it } from 'vitest';

import type { Relation } from '@/shared/read/model';

import { unitHierarchy, type UnitHierarchy } from './fold-subordinates';
import { foldEveryUnit } from './unit-folds';

const subordinate = (child: string, parent: string): Relation => ({
  id: `${child}-${parent}`,
  type: 'subordinate_to',
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

const hierarchyOf = (): UnitHierarchy =>
  unitHierarchy(
    [subordinate('b', 'a'), subordinate('c', 'b'), subordinate('d', 'a')],
    new Set(['a', 'b', 'c', 'd']),
  );

describe('the open units of a surface', () => {
  it('starts with every unit closed', () => {
    const folds = foldEveryUnit(hierarchyOf());

    expect(folds.open.size).toBe(0);
  });

  it('reveals a folded entity and says that the open units changed', () => {
    const folds = foldEveryUnit(hierarchyOf());

    expect(folds.reveal('c')).toBe(true);
    expect([...folds.open].sort()).toEqual(['a', 'b']);
    expect(folds.reveal('c')).toBe(false);
  });

  it('closes each open unit under a unit that closes', () => {
    const folds = foldEveryUnit(hierarchyOf());
    folds.reveal('c');

    expect(folds.setOpen('a', false)).toBe(true);
    expect(folds.open.size).toBe(0);
  });

  it('changes nothing for a unit with no subordinate or a unit already in that state', () => {
    const folds = foldEveryUnit(hierarchyOf());

    expect(folds.setOpen('d', true)).toBe(false);
    expect(folds.setOpen('a', false)).toBe(false);
    expect(folds.setOpen('a', true)).toBe(true);
    expect(folds.setOpen('a', true)).toBe(false);
  });
});
