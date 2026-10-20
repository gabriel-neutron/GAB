import { expect, test } from 'vitest';

import { geolocationCoverageOf } from './geolocation-coverage.ts';
import type { ReleaseEntity, ReleaseRecord } from './release-record.ts';

const POINT = { type: 'Point', coordinates: [30, 60] };

const entity = (n: number, change: Partial<ReleaseEntity>): ReleaseEntity => ({
  id: `00000000-0000-4000-8000-00000000000${String(n)}`,
  type: 'facility',
  label: `Site ${String(n)}`,
  origin_label: 'Proposed — not checked',
  sources: ['doc_a'],
  geom: POINT,
  ...change,
});

const recordOf = (entities: readonly ReleaseEntity[]): ReleaseRecord =>
  ({ entities }) as unknown as ReleaseRecord;

test('the coverage counts each method, and an entity with no place counts for none', () => {
  const found = geolocationCoverageOf(
    recordOf([
      entity(1, { geom_method: 'satellite_match' }),
      entity(2, { geom_method: 'satellite_match' }),
      entity(3, { geom_method: 'not_stated' }),
      entity(4, { geom_method: null, geom: null }),
    ]),
  );
  expect(found).toStrictEqual({
    places: 3,
    notStated: 1,
    byMethod: [
      { method: 'satellite_match', count: 2 },
      { method: 'not_stated', count: 1 },
    ],
  });
});

test('a place with no method in the record reads as not_stated', () => {
  expect(geolocationCoverageOf(recordOf([entity(1, {})]))).toStrictEqual({
    places: 1,
    notStated: 1,
    byMethod: [{ method: 'not_stated', count: 1 }],
  });
});

test('a record with no place has an empty coverage', () => {
  expect(geolocationCoverageOf(recordOf([entity(1, { geom: null })]))).toStrictEqual({
    places: 0,
    notStated: 0,
    byMethod: [],
  });
});
