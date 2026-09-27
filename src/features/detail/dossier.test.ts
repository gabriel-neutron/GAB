import { expect, test } from 'vitest';

import type { Corpus, DocumentRow, Entity, Relation } from '@/shared/read/model';

import { readDossier, readRelation } from './dossier';

const DOCUMENT: DocumentRow = {
  id: 'd1',
  kind: 'report',
  title: 'Port call register',
  uri: null,
  archiveUri: null,
  sha256: null,
  retrievedAt: null,
  admiralty: 'B2',
  admiraltyOrigin: 'human',
};

const VESSEL: Entity = {
  id: 'e1',
  type: 'vessel',
  proposedType: null,
  label: 'MV Northern Ledger',
  attrs: { flag: { v: 'Panama', src: ['d1', 'd1'] } },
  sources: ['d1'],
  geom: null,
  promotedFrom: 'p1',
};

const OWNER: Entity = { ...VESSEL, id: 'e2', label: 'Ledger Shipping', attrs: {} };

const OWNED_BY: Relation = {
  id: 'r1',
  type: 'owned_by',
  srcKind: 'entity',
  srcId: 'e1',
  dstKind: 'entity',
  dstId: 'e2',
  attrs: {},
  sources: ['d1', 'd1'],
  validFrom: null,
  validTo: null,
  promotedFrom: 'p2',
};

const CORPUS: Corpus = {
  documents: [DOCUMENT],
  entities: [VESSEL, OWNER],
  relations: [OWNED_BY],
  proposals: [],
  positions: [],
};

test('a document that one list cites twice is one mark, one card and number 1', () => {
  const dossier = readDossier(CORPUS, VESSEL.id, []);
  if (dossier === null) throw new Error('The corpus holds no vessel');

  const lists = [
    dossier.entitySources,
    ...dossier.rows.map((row) => row.sources),
    ...dossier.relations.map((line) => line.sources),
  ];
  for (const list of lists) expect(list.map((ref) => [ref.id, ref.number])).toEqual([['d1', 1]]);

  expect(dossier.sources.map((card) => [card.id, card.number])).toEqual([['d1', 1]]);
  expect(dossier.sources[0]?.holdsUp.map((line) => line.key)).toEqual(['flag']);
});

test('the relation panel and the entity page draw the same card for one document', () => {
  const dossier = readDossier(CORPUS, VESSEL.id, []);
  const relation = readRelation(CORPUS, OWNED_BY.id);
  if (dossier === null || relation === null) throw new Error('The corpus holds no such row');

  expect(relation.sources.map((ref) => [ref.id, ref.number])).toEqual([['d1', 1]]);
  expect(relation.cards).toEqual(dossier.sources.map((card) => ({ ...card, holdsUp: [] })));
});

test('a point borrowed from a parent that the entity list lacks still states that it is borrowed', () => {
  const lost: Corpus = {
    ...CORPUS,
    positions: [
      {
        entityId: VESSEL.id,
        point: { lon: 4.4777, lat: 51.9244 },
        precision: 'inherited',
        parentId: 'e9',
      },
    ],
  };
  const dossier = readDossier(lost, VESSEL.id, []);
  if (dossier === null) throw new Error('The corpus holds no vessel');

  expect(dossier.drawnOnMap).toBe(true);
  expect(dossier.positionFrom).toBe('position from a parent');
});

test('a point borrowed from a parent that the entity list holds names that parent', () => {
  const held: Corpus = {
    ...CORPUS,
    positions: [
      {
        entityId: VESSEL.id,
        point: { lon: 4.4777, lat: 51.9244 },
        precision: 'inherited',
        parentId: OWNER.id,
      },
    ],
  };
  const dossier = readDossier(held, VESSEL.id, []);

  expect(dossier?.positionFrom).toBe(`position from ${OWNER.label}`);
});
