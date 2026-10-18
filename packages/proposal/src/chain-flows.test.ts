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
