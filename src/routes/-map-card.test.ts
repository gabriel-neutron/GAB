import { expect, test } from 'vitest';

import { FIXTURE_RELEASE, CHAIN } from '@/features/globe/fixture-release';
import { globeData } from '@/features/globe/globe-data';
import { corpus } from '@/shared/committed-fixture/corpus';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

import { mapCard } from './-map-card';

const data = globeData(FIXTURE_RELEASE.chain);
const read = { corpus, types: entityTypes };

test('an entity of the record opens the panel of the graph', () => {
  const id = corpus.entities[0]?.id ?? '';
  expect(mapCard({ kind: 'entity', id }, data, read).kind).toBe('entity');
});

test('an entity that the record does not hold, and a read that did not load, say two things', () => {
  expect(mapCard({ kind: 'entity', id: 'absent' }, data, read).kind).toBe('no-record');
  expect(mapCard({ kind: 'entity', id: CHAIN.FIELD }, data, null).kind).toBe('no-read');
});

test('a link that is a relation of the record opens the panel of the relation', () => {
  const id = corpus.relations[0]?.id ?? '';
  expect(mapCard({ kind: 'arc', id }, data, read).kind).toBe('relation');
});

test('a link that the record does not hold keeps its own card', () => {
  expect(mapCard({ kind: 'arc', id: CHAIN.FIELD_TO_PIPELINE }, data, read).kind).toBe('arc');
  expect(mapCard({ kind: 'arc', id: CHAIN.FIELD_TO_PIPELINE }, data, null).kind).toBe('arc');
});

test('an exit point keeps its own card', () => {
  const id = Object.keys(data.exitInfo)[0] ?? '';
  expect(mapCard({ kind: 'exit', id }, data, read).kind).toBe('exit');
});
