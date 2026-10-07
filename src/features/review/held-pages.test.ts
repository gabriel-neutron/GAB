import { expect, it } from 'vitest';

import { afterDecision, queueUnits } from './held-pages';
import type { Unit, UnitPage } from './unit-page';

const unitOf = (id: string): Unit => ({
  id,
  kind: 'entity',
  name: id,
  type: 'military_unit',
  proposer: 'v1_import',
  group: null,
  state: 'clean',
  faults: [],
  acts: [],
  documents: [],
  passages: [],
});

const pageOf = (ids: readonly string[], next: readonly string[] | null): UnitPage => ({
  units: ids.map(unitOf),
  next,
  total: 5,
});

const PAGES = [pageOf(['a', 'b'], ['key b']), pageOf(['c', 'd'], ['key d']), pageOf(['e'], null)];

it('selects the next unit, and reads again the page that held the decided unit', () => {
  expect(afterDecision(PAGES, 'c', 'unit')).toStrictEqual({ page: 1, after: ['key b'], next: 'd' });
  expect(afterDecision(PAGES, 'a', 'unit')).toStrictEqual({ page: 0, after: null, next: 'b' });
});

it('selects the unit before the last unit of the queue', () => {
  expect(afterDecision(PAGES, 'e', 'unit')).toStrictEqual({ page: 2, after: ['key d'], next: 'd' });
  expect(afterDecision([pageOf(['a'], null)], 'a', 'unit')).toStrictEqual({
    page: 0,
    after: null,
    next: '',
  });
});

it('keeps the unit selected when one relation of it was rejected', () => {
  expect(afterDecision(PAGES, 'c', 'relation')).toStrictEqual({
    page: 1,
    after: ['key b'],
    next: 'c',
  });
});

it('shows a unit once when a page read again reaches into the next page', () => {
  const again = [PAGES[0], pageOf(['d', 'e'], ['key e']), PAGES[2]].filter(
    (page): page is UnitPage => page !== undefined,
  );
  expect(queueUnits(again).map((unit) => unit.id)).toStrictEqual(['a', 'b', 'd', 'e']);
});
