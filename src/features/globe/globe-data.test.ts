import { expect, test } from 'vitest';

import { CHAIN, FIXTURE_RELEASE } from './fixture-release';
import { globeData } from './globe-data';

const data = globeData(FIXTURE_RELEASE.chain);

test('each entity with a position is on the list, with its stage and its card', () => {
  expect(data.rows.map((one) => one.id)).toStrictEqual(data.entities.features.map((one) => one.id));
  expect(data.rows.find((one) => one.id === CHAIN.FIELD)?.stage).toBe('Fields');
  expect(Object.keys(data.cards).sort()).toStrictEqual(data.rows.map((one) => one.id).sort());
});

test('the staged entity carries the key and the hue of its stage', () => {
  const field = data.entities.features.find((one) => one.id === CHAIN.FIELD);
  expect(field?.properties['stageKey']).toBe('field');
  expect(field?.properties['colour']).toBe('#4cc27a');
});

test('a physical link has a card with its label and its product', () => {
  const arc = data.arcInfo[CHAIN.FIELD_TO_PIPELINE];
  expect(arc?.product).toBe('crude');
  expect(arc?.label).toBe('Test field to Test crude pipeline');
  expect(data.arcs.features.map((one) => one.properties.id)).toContain(CHAIN.FIELD_TO_PIPELINE);
});

test('the six steps cover the chain, and the counts say what the page says', () => {
  expect(data.steps.map((one) => one.key)).toStrictEqual([
    'extraction',
    'pipeline',
    'refinery',
    'terminal',
    'export',
    'exit',
  ]);
  expect(data.counts.arcs).toBe(data.arcs.features.length);
  expect(data.counts.byProduct.reduce((sum, one) => sum + one.links, 0)).toBe(data.counts.arcs);
});

test('the places hold each entity, link and placed exit point', () => {
  for (const one of data.rows) expect(data.places.has(one.id)).toBe(true);
  for (const one of data.arcs.features) expect(data.places.has(one.properties.id)).toBe(true);
  for (const one of data.exits.features) expect(data.places.has(one.properties.id)).toBe(true);
});

test('the fixed release gives a globe whose counts follow its files', () => {
  const plain = globeData(FIXTURE_RELEASE.plain);
  expect(plain.counts.arcs).toBe(plain.arcs.features.length);
  expect(plain.rows.length).toBe(plain.entities.features.length);
  expect(plain.counts.arcs).toBeLessThan(data.counts.arcs);
});

test('the counts of each type add up to the entities of the release and to those on the map', () => {
  const { byType } = data.counts;
  expect(byType.reduce((sum, one) => sum + one.total, 0)).toBe(
    FIXTURE_RELEASE.chain.entities.length,
  );
  expect(byType.reduce((sum, one) => sum + one.onMap, 0)).toBe(data.counts.entities);
});
