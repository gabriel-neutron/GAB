import { expect, test } from 'vitest';

import { chainView } from './chain-card.ts';
import { CHAIN } from './chain-fixture.ts';
import { chainFlows } from './chain-flows.ts';
import { chainMapData } from './chain-map-data.ts';
import { FIXTURE_RELEASE } from './fixture-release.ts';
import type { SiteVolume } from '@gab/release/site-release';
import { volumeCard } from './volume-card.ts';

const {
  FIELD_TO_PIPELINE,
  PIPELINE_TO_ABROAD,
  PIPELINE_TO_REFINERY,
  PIPELINE_TO_TERMINAL,
  REFINERY_TO_PORT,
  REFINERY_TO_TERMINAL,
} = CHAIN;

const outside = ([lon, lat]: readonly [number, number]): boolean => lon < 34 && lat < 54;

const flows = chainFlows(FIXTURE_RELEASE.chain, chainView(FIXTURE_RELEASE.chain).stages, outside);
const data = chainMapData(flows);
const lineOf = (id: string) =>
  data.arcs.features.find((one) => one.properties.id === id)?.properties;
// A volume made for the test.
const VOLUME: SiteVolume = {
  period: '2026-07',
  value: 7,
  minimum: null,
  maximum: null,
  unit: 'kb/j',
  volumeClass: 'observed',
  documentTitle: 'A test document',
  documentAddress: null,
  page: '',
  note: '',
};
const cardOf = (id: string) => data.links.arcs.find((one) => one.id === id)?.volumes ?? [];

test('a link with a flow and a capacity draws the flow, and never adds the capacity to it', () => {
  const arc = flows.arcs.find((one) => one.id === FIELD_TO_PIPELINE);
  expect(arc?.volume).toMatchObject({ volumeClass: 'observed', value: 400, unit: 'kb/j' });
  expect(arc?.volumes.map((one) => one.value)).toEqual([400, 600]);
});

test('each class has its line: observed full, estimated hatched with a halo, capacity hollow', () => {
  expect(lineOf(FIELD_TO_PIPELINE)?.style).toBe('observed');
  expect(lineOf(PIPELINE_TO_REFINERY)?.style).toBe('estimated');
  expect(lineOf(REFINERY_TO_PORT)?.style).toBe('capacity');
  const estimated = lineOf(PIPELINE_TO_REFINERY);
  expect(estimated?.halo).toBeGreaterThan(estimated?.width ?? 0);
});

test('the width of a flow grows with its central value, among the rows of the same unit', () => {
  const big = lineOf(FIELD_TO_PIPELINE)?.width ?? 0;
  const small = lineOf(PIPELINE_TO_TERMINAL)?.width ?? 0;
  expect(big).toBeGreaterThan(small);
  expect(small).toBeGreaterThan(2);
});

test('a link with no volume has one width, and a link in review keeps its style', () => {
  expect(lineOf(PIPELINE_TO_ABROAD)).toMatchObject({ width: 2, style: 'dashed' });
  expect(lineOf(REFINERY_TO_TERMINAL)).toMatchObject({ width: 2, style: 'in review' });
});

test('the card of a link gives the value, the range, the period, the class and the source', () => {
  const [estimate] = cardOf(PIPELINE_TO_REFINERY);
  expect(estimate?.text).toBe('Estimated: 150 kb/d, from 100 to 180 kb/d, period 2026-07.');
  expect(estimate?.source).toBe('Source: A test document, page 2.');
  expect(estimate?.href).toBe('https://chain.example.org/page');
  expect(cardOf(FIELD_TO_PIPELINE).map((one) => one.text)).toEqual([
    'Observed: 400 kb/d, period 2026-07. Note: a test note.',
    'Capacity: 600 kb/d, period 2026-07. A nominal capacity, not a flow.',
  ]);
  expect(cardOf(PIPELINE_TO_ABROAD)).toEqual([]);
});

test('the card gives the unit in English, and keeps a unit that it does not know', () => {
  expect(cardOf(REFINERY_TO_PORT).map((one) => one.text)).toEqual([
    'Capacity: 5 Mt/year, period 2026-07. A nominal capacity, not a flow.',
  ]);
  expect(volumeCard([{ ...VOLUME, unit: 'barils/semaine' }], false)[0]?.text).toBe(
    'Observed: 7 barils/semaine, period 2026-07.',
  );
});

test('each volume of a link in review is marked in review, so the card never gives it as a fact', () => {
  expect(cardOf(REFINERY_TO_TERMINAL).map((one) => one.text)).toEqual([
    'In review, not a fact: Observed: 50 kt/month, period 2026-07.',
  ]);
});
