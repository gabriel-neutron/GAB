import { expect, test } from 'vitest';

import { chainView } from './chain-card.ts';
import { CHAIN } from './chain-fixture.ts';
import { chainFlows } from './chain-flows.ts';
import { chainSteps } from './chain-steps.ts';
import { FIXTURE_RELEASE } from './fixture-release.ts';

const { FIELD, PIPELINE_TO_ABROAD, PORT_TO_ABROAD, REFINERY_TO_TERMINAL, TERMINAL_ABROAD } = CHAIN;

// In this test, a position is outside Russia when it is south-west of the point 34 E, 54 N, as in
// the test of the flows.
const outside = ([lon, lat]: readonly [number, number]): boolean => lon < 34 && lat < 54;

const flows = chainFlows(FIXTURE_RELEASE.chain, chainView(FIXTURE_RELEASE.chain).stages, outside);
const steps = new Map(chainSteps(flows).map((one) => [one.key, one]));

test('the six steps go from the well to the exit, each with its count', () => {
  expect([...steps.values()].map((one) => [one.label, one.count])).toEqual([
    ['Extraction', 1],
    ['Pipeline', 4],
    ['Refinery', 1],
    ['Terminal', 2],
    ['Export', 2],
    ['Exit', 4],
  ]);
  expect(steps.get('extraction')?.assets).toEqual([FIELD]);
  expect(steps.get('extraction')?.sentence).toBe('1 field has a position.');
});

test('the export step takes the links after the export stage and the declared destinations', () => {
  const step = steps.get('export');
  expect(step?.arcs.toSorted()).toEqual([PIPELINE_TO_ABROAD, PORT_TO_ABROAD].toSorted());
  expect(step?.assets).toContain(TERMINAL_ABROAD);
});

test('no step puts a link or an exit point in review forward', () => {
  const all = [...steps.values()];
  expect(all.flatMap((one) => one.arcs)).not.toContain(REFINERY_TO_TERMINAL);
  const review = flows.exits.filter((one) => one.inReview).map((one) => one.id);
  expect(review).toHaveLength(1);
  expect(all.flatMap((one) => one.exits)).not.toContain(review[0]);
});

test('the exit step says how many exit points have no position and are not on the map', () => {
  const exit = (id: string, position: readonly [number, number] | null) => ({
    id,
    kind: 'sts' as const,
    label: 'Ship-to-ship transfer',
    why: '',
    position,
    assets: [],
    inReview: false,
  });
  const [, , , , , last] = chainSteps({
    ...flows,
    exits: [exit('placed', [30, 60]), exit('unplaced-1', null), exit('unplaced-2', null)],
  });
  expect(last?.count).toBe(3);
  expect(last?.sentence).toMatch(/ 2 of them have no position and are not on the map\.$/u);
});
