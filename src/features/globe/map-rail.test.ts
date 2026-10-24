import { expect, test } from 'vitest';

import { FIXTURE_RELEASE } from './fixture-release';
import { globeData } from './globe-data';
import { mapRail } from './map-rail';

const data = globeData(FIXTURE_RELEASE.chain);
const base = { hiddenTypes: [], openTypes: [], open: true, width: 256 };

test('each type of a point has one row, and the rows count every point', () => {
  const { rail } = mapRail(data, base);
  const total = rail.types.reduce((sum, row) => sum + row.count, 0);
  expect(total).toBe(data.entities.features.filter((one) => one.id in data.cards).length);
  expect(rail.types.every((row) => row.on && !row.open)).toBe(true);
});

test('an open type lists its names in order, and a type that is off lists none', () => {
  const type = mapRail(data, base).rail.types[0]?.type ?? '';
  const open = mapRail(data, { ...base, openTypes: [type] });
  const names = open.lists.get(type)?.map((one) => one.label) ?? [];
  expect(names.length).toBeGreaterThan(0);
  expect(names).toEqual([...names].sort((one, two) => one.localeCompare(two)));
  const off = mapRail(data, { ...base, openTypes: [type], hiddenTypes: [type] });
  expect(off.lists.has(type)).toBe(false);
  expect(off.rail.types.find((row) => row.type === type)?.on).toBe(false);
});
