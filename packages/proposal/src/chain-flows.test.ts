import { expect, test } from 'vitest';

import { chainFlows, type ChainRelation } from './chain-flows.ts';
import { chainSteps } from './chain-steps.ts';

// A small chain: a field, a terminal in Russia, a refinery abroad and a vessel. A position is
// outside Russia when its longitude is under 20.
const placed = new Map<string, readonly (readonly [number, number])[]>([
  ['field', [[70, 62]]],
  ['terminal', [[30, 60]]],
  ['abroad', [[10, 50]]],
]);
const outside = ([lon]: readonly [number, number]): boolean => lon < 20;
const link = (id: string, fromId: string, toId: string, accepted = true): ChainRelation => ({
  id,
  type: 'crude_flows_to',
  fromId,
  fromLabel: fromId,
  toId,
  toLabel: toId,
  accepted,
});
const relations: ChainRelation[] = [
  link('field-to-terminal', 'field', 'terminal'),
  link('terminal-to-abroad', 'terminal', 'abroad'),
  link('field-to-abroad', 'field', 'abroad', false),
  { ...link('loading', 'vessel', 'terminal'), type: 'loads_at' },
];
const kindStages = new Map([
  ['field', 'field' as const],
  ['terminal', 'export' as const],
  ['abroad', null],
]);

const flows = chainFlows({ placed, entityAccepted: () => true, relations }, kindStages, outside);

test('a physical link between two placed assets is an arc, and a proposal is in review', () => {
  const arcs = new Map(flows.arcs.map((one) => [one.id, one]));
  expect(arcs.get('field-to-terminal')).toMatchObject({ inReview: false, afterExport: false });
  expect(arcs.get('terminal-to-abroad')).toMatchObject({ inReview: false, afterExport: true });
  expect(arcs.get('field-to-abroad')?.inReview).toBe(true);
});

test('an asset abroad at the end of an accepted link is a declared destination', () => {
  expect(flows.stages.get('abroad')).toBe('destination');
});

test('a loading at a port in Russia and a link across the border give exit points', () => {
  expect(flows.exits.map((one) => [one.kind, one.inReview]).toSorted()).toEqual(
    [
      ['border', false],
      ['border', true],
      ['port_sale', false],
    ].toSorted(),
  );
});

test('no step puts the link in review forward', () => {
  const arcs = chainSteps(flows).flatMap((one) => one.arcs);
  expect(arcs.toSorted()).toEqual(['field-to-terminal', 'terminal-to-abroad']);
});

test('a ship-to-ship transfer is an exit point, and an asset with no position gives none', () => {
  const more = chainFlows(
    {
      placed: new Map([...placed, ['vessel-a', [[25, 58]]], ['unplaced', []]]),
      entityAccepted: () => true,
      relations: [
        { ...link('transfer', 'vessel-a', 'vessel-b'), type: 'sts_with' },
        { ...link('loading-unplaced', 'vessel', 'unplaced'), type: 'loads_at' },
      ],
    },
    kindStages,
    outside,
  );
  expect(more.exits.map((one) => [one.kind, one.position])).toEqual([['sts', [25, 58]]]);
});

test('a link to an entity that is still a proposal is in review', () => {
  const review = chainFlows(
    { placed, entityAccepted: (id) => id !== 'abroad', relations },
    kindStages,
    outside,
  );
  expect(review.arcs.find((one) => one.id === 'terminal-to-abroad')?.inReview).toBe(true);
});

test('a place abroad where a vessel that loads in Russia discharges is a declared destination', () => {
  const discharge = (id: string, accepted: boolean): ChainRelation => ({
    ...link(id, 'carrier', 'abroad', accepted),
    type: 'discharges_at',
  });
  const loads = { ...link('loads', 'carrier', 'terminal'), type: 'loads_at' };
  const stagesOf = (one: ChainRelation, loading: ChainRelation[] = [loads]) =>
    chainFlows(
      { placed, entityAccepted: () => true, relations: [...loading, one] },
      kindStages,
      outside,
    ).stages;
  expect(stagesOf(discharge('discharge', true)).get('abroad')).toBe('destination');
  expect(stagesOf(discharge('proposed', false)).get('abroad')).toBeNull();
  // A vessel with no loading in Russia gives no destination: it can carry a cargo of another land.
  expect(stagesOf(discharge('discharge', true), []).get('abroad')).toBeNull();
  expect(
    stagesOf({ ...link('home', 'carrier', 'terminal'), type: 'discharges_at' }).get('terminal'),
  ).toBe('export');
});

test('a gas link from a field to an LNG plant is an arc of the gas chain', () => {
  const gas = chainFlows(
    {
      placed,
      entityAccepted: () => true,
      relations: [{ ...link('field-to-plant', 'field', 'terminal'), type: 'gas_flows_to' }],
    },
    kindStages,
    outside,
  );
  expect(gas.arcs).toMatchObject([{ id: 'field-to-plant', product: 'gas' }]);
});

test('the Export step counts a destination that only a discharge gives', () => {
  const carrier = (type: string, to: string): ChainRelation => ({
    ...link(`${type}-${to}`, 'carrier', to),
    type,
  });
  const only = chainFlows(
    {
      placed,
      entityAccepted: () => true,
      relations: [carrier('loads_at', 'terminal'), carrier('discharges_at', 'abroad')],
    },
    kindStages,
    outside,
  );
  const step = chainSteps(only).find((one) => one.key === 'export');
  expect(step).toMatchObject({ count: 0, assets: ['abroad'], arcs: [] });
  expect(step?.sentence).toMatch(
    /^0 physical links go on after the export stage\. 1 declared destination has a position/u,
  );
});
