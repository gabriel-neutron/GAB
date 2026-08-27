// The corpus the four surfaces receive, read from the live service over HTTP. Every story runs
// on the committed fixture, so no other check reads the live record through this path.

import { expect, test } from 'vitest';

import { corpus as fixture } from '../fixtures/corpus';
import { loadCorpus } from './corpus';
import type { Corpus, Point } from './model';

const KINDS = ['documents', 'entities', 'relations', 'proposals'] as const;

const keysOf = (row: object): string => Object.keys(row).sort().join(', ');

const onTheGlobe = (point: Point): boolean =>
  Number.isFinite(point.lon) &&
  Number.isFinite(point.lat) &&
  Math.abs(point.lon) <= 180 &&
  Math.abs(point.lat) <= 90;

const counted = (read: Corpus): Readonly<Record<string, number>> => ({
  documents: read.documents.length,
  entities: read.entities.length,
  relations: read.relations.length,
  proposals: read.proposals.length,
});

test('the live service gives the record the surfaces draw', async () => {
  expect(counted(await loadCorpus())).toStrictEqual({
    documents: 5,
    entities: 27,
    relations: 17,
    proposals: 3,
  });
});

test('every entity carries a label and a type, which each surface prints', async () => {
  const read = await loadCorpus();
  const blank = read.entities
    .filter((entity) => entity.label.trim() === '' || entity.type.trim() === '')
    .map((entity) => entity.id);
  expect(blank).toStrictEqual([]);
});

test('the position of an entity is absent, or a point on the globe', async () => {
  const read = await loadCorpus();
  const off = read.entities
    .filter((entity) => entity.geom !== null && !onTheGlobe(entity.geom))
    .map((entity) => `${entity.label}: ${JSON.stringify(entity.geom)}`);
  expect(off).toStrictEqual([]);
});

// The review queue and the detail page both filter on the pending status, so a decided act that
// arrived here would be drawn by neither and counted by both.
test('only a pending act arrives, and the corpus carries no other status', async () => {
  const read = await loadCorpus();
  expect([...new Set(read.proposals.map((act) => act.status))]).toStrictEqual(['pending']);
});

for (const kind of KINDS)
  test(`every live ${kind} row carries the keys the fixture carries`, async () => {
    const read = await loadCorpus();
    const [stated] = fixture[kind].map((row) => keysOf(row));
    expect([...new Set(read[kind].map((row) => keysOf(row)))]).toStrictEqual([stated]);
  });

// A surface resolves each source against the document list, so an identifier that no document
// carries draws an empty card.
test('every source of an entity and of a relation names a document that arrived', async () => {
  const read = await loadCorpus();
  const held = new Set(read.documents.map((document) => document.id));
  const named = [...read.entities, ...read.relations].flatMap((row) =>
    row.sources.filter((source) => !held.has(source)).map((source) => `${row.id}: ${source}`),
  );
  expect(named).toStrictEqual([]);
});
