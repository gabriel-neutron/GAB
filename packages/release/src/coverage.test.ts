import { expect, test } from 'vitest';

import { coverageOf } from './coverage.ts';

test('the coverage counts the entities in total and for each type, largest first', () => {
  const coverage = coverageOf(['vessel', 'company', 'vessel', 'unit', 'company', 'vessel'], 4);
  expect(coverage.entities).toBe(6);
  expect(coverage.sources).toBe(4);
  expect(coverage.byType).toStrictEqual([
    { type: 'vessel', count: 3 },
    { type: 'company', count: 2 },
    { type: 'unit', count: 1 },
  ]);
});

test('the coverage of an empty record has no type', () => {
  expect(coverageOf([], 0).byType).toStrictEqual([]);
});

test('the scope says what an absence means', () => {
  expect(coverageOf([], 0).scope.absence).toContain('not yet in the record');
});
