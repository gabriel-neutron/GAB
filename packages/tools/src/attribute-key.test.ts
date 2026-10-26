import { expect, test } from 'vitest';

import { keyWarnings } from './attribute-key.ts';

test('a variant of a known key gets a warning that names the key to write', () => {
  expect(keyWarnings(['dwt_t', 'gross_tonnage_t'])).toEqual([
    'the key dwt_t is a variant of capacity_dwt: write capacity_dwt for the same quantity',
    'the key gross_tonnage_t is a variant of gross_tonnage_gt: write gross_tonnage_gt for the same quantity',
  ]);
});

test('a canonical key and an unrelated key get no warning', () => {
  expect(keyWarnings(['capacity_dwt', 'former_names', 'revenue_usd', 'grt'])).toEqual([]);
});
