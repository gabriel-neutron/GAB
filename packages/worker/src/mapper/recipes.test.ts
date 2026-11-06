import { mappingDraft } from '@gab/proposal/mapping';
import { expect, test } from 'vitest';

import { isRecipeHost, recipeOf } from './recipes.ts';

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

const EUROSTAT = [
  'DATAFLOW',
  'LAST UPDATE',
  'freq',
  'siec',
  'partner',
  'unit',
  'geo',
  'TIME_PERIOD',
  'OBS_VALUE',
  'OBS_FLAG',
  'CONF_STATUS',
];
const EUROSTAT_ADDRESS =
  'https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/nrg_ti_gas/A.G3000.RU.MIO_M3.' +
  '?format=SDMX-CSV&startPeriod=2021&endPeriod=2025';
const EUROSTAT_OIL =
  'https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/nrg_ti_oil/' +
  'A.O4100_TOT.RU.THS_T.?format=SDMX-CSV&startPeriod=2021&endPeriod=2025';

test('the recipe of the Eurostat import tables gives a valid mapping for gas and crude', () => {
  expect(mappingDraft.safeParse(recipeOf(EUROSTAT_ADDRESS, EUROSTAT)).success).toBe(true);
  const oil = recipeOf(EUROSTAT_OIL, EUROSTAT);
  expect(mappingDraft.safeParse(oil).success).toBe(true);
  expect(oil?.table).toBe('nrg_ti_oil');
});

test.each([
  ['the monthly gas table', EUROSTAT_ADDRESS.replace('nrg_ti_gas', 'nrg_ti_gasm'), EUROSTAT],
  ['another dataset', EUROSTAT_ADDRESS.replace('nrg_ti_gas', 'nrg_ti_coal'), EUROSTAT],
  [
    'the composite code of crude with NGL and additives',
    EUROSTAT_OIL.replace('O4100_TOT', 'O4100_TOT_4200-4500'),
    EUROSTAT,
  ],
  ['a header that changed', EUROSTAT_ADDRESS, [...EUROSTAT, 'extra']],
])('no Eurostat recipe answers for %s', (_name, address, header) => {
  expect(recipeOf(address, header)).toBeUndefined();
});

const COMTRADE = (
  'typeCode,freqCode,refPeriodId,refYear,refMonth,period,reporterCode,reporterISO,reporterDesc,' +
  'flowCode,flowDesc,partnerCode,partnerISO,partnerDesc,partner2Code,partner2ISO,partner2Desc,' +
  'classificationCode,classificationSearchCode,isOriginalClassification,cmdCode,cmdDesc,aggrLevel,' +
  'isLeaf,customsCode,customsDesc,mosCode,motCode,motDesc,qtyUnitCode,qtyUnitAbbr,qty,' +
  'isQtyEstimated,altQtyUnitCode,altQtyUnitAbbr,altQty,isAltQtyEstimated,netWgt,' +
  'isNetWgtEstimated,grossWgt,isGrossWgtEstimated,cifvalue,fobvalue,primaryValue,' +
  'legacyEstimationFlag,isReported,isAggregate'
).split(',');
const COMTRADE_ADDRESS =
  'https://comtradeapi.un.org/data/v1/get/C/A/HS?reporterCode=156&period=2024&flowCode=X&' +
  'cmdCode=8541&partnerCode=643&customsCode=C00&motCode=0&partner2Code=0';

test('the recipe of Comtrade gives a valid mapping, with the measure of the flow in the address', () => {
  const exported = recipeOf(COMTRADE_ADDRESS, COMTRADE);
  expect(mappingDraft.safeParse(exported).success).toBe(true);
  expect(exported?.rows).toMatchObject({ measure: 'exports', period: { length: 'year' } });
  const imported = recipeOf(
    COMTRADE_ADDRESS.replace('flowCode=X', 'flowCode=M').replace('/A/', '/M/'),
    COMTRADE,
  );
  expect(mappingDraft.safeParse(imported).success).toBe(true);
  expect(imported?.rows).toMatchObject({ measure: 'imports', period: { length: 'month' } });
});

test.each([
  ['a flow that is not X or M', COMTRADE_ADDRESS.replace('flowCode=X', 'flowCode=RX'), COMTRADE],
  ['no flow', COMTRADE_ADDRESS.replace('flowCode=X&', ''), COMTRADE],
  ['another path', COMTRADE_ADDRESS.replace('/get/C/A/HS', '/getDA/C/A/HS'), COMTRADE],
  ['a header that changed', COMTRADE_ADDRESS, [...COMTRADE, 'extra']],
  ['a table with a row for each breakdown', COMTRADE_ADDRESS.replace('&motCode=0', ''), COMTRADE],
  ['a list of modes', COMTRADE_ADDRESS.replace('motCode=0', 'motCode=0,2100'), COMTRADE],
  ['a list of customs codes', COMTRADE_ADDRESS.replace('C00', 'C00,C01'), COMTRADE],
  ['a second value', `${COMTRADE_ADDRESS}&partner2Code=251`, COMTRADE],
])('no Comtrade recipe answers for %s', (_name, address, header) => {
  expect(recipeOf(address, header)).toBeUndefined();
});

test('a recipe host is known also for a table that no recipe knows', () => {
  expect(isRecipeHost(COMTRADE_ADDRESS.replace('motCode=0', 'motCode=0,2100'))).toBe(true);
  expect(
    isRecipeHost('https://api.russiafossiltracker.com/v0/chart/departure_by_port?commodity=lng'),
  ).toBe(true);
  expect(isRecipeHost('https://example.org/table.csv')).toBe(false);
  expect(isRecipeHost('not an address')).toBe(false);
  expect(isRecipeHost(null)).toBe(false);
});
