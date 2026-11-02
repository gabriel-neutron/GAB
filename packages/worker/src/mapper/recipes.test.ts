import { mappingDraft } from '@gab/proposal/mapping';
import { expect, test } from 'vitest';

import { recipeOf } from './recipes.ts';

const COUNTER = [
  'destination_iso2,destination_country,destination_region,destination_regions,commodity,',
  'commodity_group,commodity_group_name,year,pricing_scenario,pricing_scenario_name,version,',
  'value_tonne,value_eur,value_usd',
]
  .join('')
  .split(',');
const ADDRESS =
  'https://api.russiafossiltracker.com/v0/counter?format=csv&date_from=2021-01-01&' +
  'date_to=2025-12-31&commodity=natural_gas&aggregate_by=destination_country,commodity,year';

test('the recipe of the buyer table gives a valid mapping for each commodity of the tracker', () => {
  const mapping = recipeOf(ADDRESS, COUNTER);
  expect(mappingDraft.safeParse(mapping).success).toBe(true);
  expect(recipeOf(ADDRESS.replace('natural_gas', 'lng'), COUNTER)?.table).toBe(
    'crea_exports_by_buyer_lng',
  );
});

test.each([
  ['a commodity that has no measure', ADDRESS.replace('natural_gas', 'coal'), COUNTER],
  ['another host', ADDRESS.replace('api.russiafossiltracker.com', 'example.test'), COUNTER],
  ['a header that changed', ADDRESS, [...COUNTER, 'extra']],
  ['no address', null, COUNTER],
])('no recipe answers for %s', (_name, address, header) => {
  expect(recipeOf(address, header)).toBeUndefined();
});
