import { describe, expect, it } from 'vitest';

import { corpus } from '@/shared/committed-fixture/corpus';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

import { indexLines } from './index-tree';
import { entitiesOfType, project, railLegend, railRows } from './projection';

const projection = project(corpus, entityTypes);
const units = entitiesOfType(projection, 'military_unit');

const parent = units.find((unit) => projection.hierarchy.subordinatesOf(unit.id).length > 0);
if (parent === undefined) throw new Error('The committed corpus draws no unit with a subordinate');
const [child] = projection.hierarchy.subordinatesOf(parent.id);
if (child === undefined) throw new Error('The committed corpus draws no subordinate');

const FRAME = { open: true, width: 240 };

const unitRow = (open: ReadonlySet<string>) =>
  railRows(
    railLegend(projection, () => true, open),
    [],
    FRAME,
    true,
  ).types.find((row) => row.type === 'military_unit');

describe('the chain of command on the map rail', () => {
  it('reads the chain of command from the relations between drawn entities', () => {
    expect(projection.hierarchy.subordinatesOf(parent.id)).toContain(child);
  });

  it('counts every entity of a type, whether a unit is open or closed', () => {
    expect(unitRow(new Set())?.count).toBe(units.length);
    expect(unitRow(new Set([parent.id]))?.count).toBe(units.length);
  });

  it('draws every entity on the map, whether a unit is open or closed', () => {
    const closed = railLegend(projection, () => true, new Set()).drawn;
    const open = railLegend(projection, () => true, new Set([parent.id])).drawn;

    expect(closed).toBe(projection.entities.length);
    expect(open).toBe(projection.entities.length);
  });

  it('lists a closed unit alone, and an open one with its subordinate one level under it', () => {
    const closed = indexLines(
      projection,
      railLegend(projection, () => true, new Set()),
      'military_unit',
      '',
      null,
    );
    const open = indexLines(
      projection,
      railLegend(projection, () => true, new Set([parent.id])),
      'military_unit',
      '',
      null,
    );

    expect(closed.map((line) => line.id)).not.toContain(child);
    expect(open.map((line) => [line.id, line.depth])).toContainEqual([child, 1]);
  });

  it('lists a folded match for a search, so the search still reaches it', () => {
    const label = projection.byId.get(child)?.label ?? '';
    const found = indexLines(
      projection,
      railLegend(projection, () => true, new Set()),
      'military_unit',
      label,
      null,
    );

    expect(found.map((line) => [line.id, line.depth])).toEqual([[child, 0]]);
  });

  it('carries the stored width of the rail to the rows', () => {
    expect(
      railRows(
        railLegend(projection, () => true, new Set()),
        [],
        FRAME,
        true,
      ).width,
    ).toBe(240);
  });
});
