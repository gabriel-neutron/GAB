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

const EUROSTAT =
  [
    'DATAFLOW,LAST UPDATE,freq,siec,partner,unit,geo,TIME_PERIOD,OBS_VALUE,OBS_FLAG,CONF_STATUS',
  ][0]?.split(',') ?? [];
const EUROSTAT_ADDRESS =
  'https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/nrg_ti_gas/A.G3000.RU.MIO_M3.' +
  '?format=SDMX-CSV&startPeriod=2021&endPeriod=2025';

test('the recipe of the Eurostat import tables gives a valid mapping for gas and crude', () => {
  expect(mappingDraft.safeParse(recipeOf(EUROSTAT_ADDRESS, EUROSTAT)).success).toBe(true);
  expect(recipeOf(EUROSTAT_ADDRESS.replace('nrg_ti_gas', 'nrg_ti_oil'), EUROSTAT)?.table).toBe(
    'nrg_ti_oil',
  );
  expect(recipeOf(EUROSTAT_ADDRESS.replace('nrg_ti_gas', 'nrg_ti_coal'), EUROSTAT)).toBeUndefined();
  expect(recipeOf(EUROSTAT_ADDRESS, [...EUROSTAT, 'extra'])).toBeUndefined();
});
