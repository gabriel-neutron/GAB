import { expect, test } from 'vitest';

import { chainView } from './chain-card.ts';
import { CHAIN } from './chain-fixture.ts';
import { chainFlows } from './chain-flows.ts';
import { chainOf, productChain } from '@gab/proposal/chain-highlight';
import { FIXTURE_RELEASE } from './fixture-release.ts';

const {
  CRUDE_TERMINAL,
  FIELD,
  FIELD_TO_PIPELINE,
  OTHER_TANKER,
  PIPELINE,
  PIPELINE_TO_ABROAD,
  PIPELINE_TO_REFINERY,
  PIPELINE_TO_TERMINAL,
  PORT_TO_ABROAD,
  PRODUCTS_PORT,
  REFINERY,
  REFINERY_ABROAD,
  REFINERY_TO_PORT,
  REFINERY_TO_TERMINAL,
  TANKER,
  TERMINAL_ABROAD,
} = CHAIN;

// The fixed release under the chain holds one more crude link, from a pipeline to Primorsk, so
// that its volume table has a link to join. Primorsk is a proposed entity, so the link is in
// review: the filter keeps its arc, but the link puts no asset forward.
const FIXED_LINK = '0a1f0000-0000-4000-8000-000000000032';

// In this test, a position is outside Russia when it is south-west of the point 34 E, 54 N. The
// two assets abroad of the fixture are there, and no other asset is.
const outside = ([lon, lat]: readonly [number, number]): boolean => lon < 34 && lat < 54;

const flows = chainFlows(FIXTURE_RELEASE.chain, chainView(FIXTURE_RELEASE.chain).stages, outside);

test('each stage of the strip counts its accepted assets and exit points', () => {
  expect(Object.fromEntries(flows.counts)).toEqual({
    field: 1,
    transport: 1,
    processing: 1,
    export: 2,
    exit: 4,
    destination: 2,
  });
});

test('an asset outside Russia at the far end of a link is a declared destination', () => {
  expect(flows.stages.get(REFINERY_ABROAD)).toBe('destination');
  expect(flows.stages.get(TERMINAL_ABROAD)).toBe('destination');
  expect(flows.stages.get(PRODUCTS_PORT)).toBe('export');
});

test('each physical link between two placed assets is an arc of its product', () => {
  const arcs = new Map(flows.arcs.map((one) => [one.id, one]));
  expect(arcs.get(FIELD_TO_PIPELINE)).toMatchObject({ product: 'crude', inReview: false });
  expect(arcs.get(REFINERY_TO_PORT)).toMatchObject({ product: 'products', afterExport: false });
  expect(arcs.get(PORT_TO_ABROAD)?.afterExport).toBe(true);
  expect(arcs.get(REFINERY_TO_TERMINAL)?.inReview).toBe(true);
  expect(arcs.get(FIELD_TO_PIPELINE)?.path.length).toBeGreaterThan(2);
  expect(arcs.size).toBe(8);
});

test('each exit point says why it is an exit point', () => {
  const exits = flows.exits.map((one) => [one.kind, one.why, one.inReview]);
  expect(exits).toContainEqual([
    'port_sale',
    'Sale at a Russian port: 1 vessel loads at Test crude terminal.',
    false,
  ]);
  expect(exits).toContainEqual([
    'sts',
    'Ship-to-ship transfer: Test tanker and Other test tanker.',
    false,
  ]);
  expect(exits).toContainEqual([
    'border',
    'Handover at the border: Test crude pipeline sends crude oil to Test refinery abroad, outside Russia.',
    false,
  ]);
  // The fixed release holds one proposed loading at Primorsk: the exit is in review.
  expect(flows.exits.filter((one) => one.inReview)).toHaveLength(1);
});

test('the product filter keeps the arcs of the product and the assets on them', () => {
  const crude = productChain(flows, 'crude');
  expect([...crude.arcs].toSorted()).toEqual(
    [
      FIELD_TO_PIPELINE,
      PIPELINE_TO_ABROAD,
      PIPELINE_TO_REFINERY,
      PIPELINE_TO_TERMINAL,
      FIXED_LINK,
    ].toSorted(),
  );
  expect([...crude.assets].toSorted()).toEqual(
    [FIELD, PIPELINE, REFINERY, CRUDE_TERMINAL, REFINERY_ABROAD].toSorted(),
  );
  const products = productChain(flows, 'products');
  expect(products.arcs.has(REFINERY_TO_TERMINAL)).toBe(true);
  expect(products.assets.has(CRUDE_TERMINAL)).toBe(false);
  expect(productChain(flows, 'gas').arcs.size).toBe(0);
});

test('the chain of an asset goes upstream and downstream along the accepted links', () => {
  const chain = chainOf(flows, PRODUCTS_PORT);
  expect([...chain.assets].toSorted()).toEqual(
    [FIELD, PIPELINE, REFINERY, PRODUCTS_PORT, TERMINAL_ABROAD].toSorted(),
  );
  expect(chain.arcs.has(PIPELINE_TO_ABROAD)).toBe(false);
  expect([...chain.exits]).toEqual([`exit-border-${PORT_TO_ABROAD}`]);
  expect(chain.arcs.has(REFINERY_TO_TERMINAL)).toBe(false);
  expect(chainOf(flows, TANKER).assets.has(OTHER_TANKER)).toBe(false);
});

test('an asset with no position gives no exit point: the map cannot tell that it is in Russia', () => {
  const ids = flows.exits.map((one) => one.id);
  expect(ids).not.toContain(`exit-sale-${CHAIN.UNPLACED_PORT}`);
  expect(ids).not.toContain(`exit-border-${CHAIN.UNPLACED_TO_ABROAD}`);
});
