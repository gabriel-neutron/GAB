import { expect, test } from 'vitest';

import type { DecidedAct } from '@/shared/read/decided-acts';
import type {
  Corpus,
  DocumentRow,
  Entity,
  EntityTypeDeclaration,
  Proposal,
  Relation,
  RelationTypeDeclaration,
} from '@/shared/read/model';

import { readDossier, readRelation, type PendingLine } from './dossier';

const DOCUMENT: DocumentRow = {
  id: 'd1',
  kind: 'report',
  title: 'Port call register',
  uri: null,
  archiveUri: null,
  sha256: null,
  retrievedAt: null,
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
  proposedType: null,
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
  relationTypes: [],
};

test('a document that one list cites twice is one mark, one card and number 1', () => {
  const dossier = readDossier(CORPUS, VESSEL.id, [], []);
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
  const dossier = readDossier(CORPUS, VESSEL.id, [], []);
  const relation = readRelation(CORPUS, OWNED_BY.id);
  if (dossier === null || relation === null) throw new Error('The corpus holds no such row');

  expect(relation.sources.map((ref) => [ref.id, ref.number])).toEqual([['d1', 1]]);
  expect(relation.cards).toEqual(dossier.sources.map((card) => ({ ...card, holdsUp: [] })));
});

const OWNS: RelationTypeDeclaration = {
  key: 'owns',
  label: 'owns',
  inverseLabel: 'is owned by',
  takesInterval: true,
  retired: false,
};

test('a relation read from its far end takes the inverse words of its type', () => {
  const read: Corpus = {
    ...CORPUS,
    relations: [{ ...OWNED_BY, type: 'owns', srcId: OWNER.id, dstId: VESSEL.id }],
    relationTypes: [OWNS],
  };
  const sentences = (entityId: string): readonly string[] =>
    readDossier(read, entityId, [], [])?.relations.map((line) => line.sentence) ?? [];

  expect(sentences(OWNER.id)).toEqual(['Ledger Shipping owns MV Northern Ledger']);
  expect(sentences(VESSEL.id)).toEqual(['MV Northern Ledger is owned by Ledger Shipping']);
});

test('a point borrowed from a parent that the entity list lacks still states that it is borrowed', () => {
  const lost: Corpus = {
    ...CORPUS,
    positions: [
      {
        entityId: VESSEL.id,
        point: { lon: 4.4777, lat: 51.9244 },
        precision: 'inherited',
        area: null,
        parentId: 'e9',
      },
    ],
  };
  const dossier = readDossier(lost, VESSEL.id, [], []);
  if (dossier === null) throw new Error('The corpus holds no vessel');

  expect(dossier.drawnOnMap).toBe(true);
  expect(dossier.positionFrom).toBe('position from a parent');
});

const THIRD: Entity = { ...VESSEL, id: 'e3', label: 'Rotterdam', attrs: {} };

const ACT: Proposal = {
  id: 'a0',
  op: 'update_attrs',
  targetKind: 'relation',
  targetId: OWNED_BY.id,
  payload: { kind: 'attrs', attrs: {} },
  src: ['d1'],
  names: [],
  priorValue: null,
  dissent: false,
  authorRole: 'gabriel_agent',
  proposer: 'extractor',
  status: 'pending',
  createdAt: '2026-09-01T00:00:00Z',
  decidedAt: null,
  decidedBy: null,
  decidedAs: null,
  decisionOrigin: null,
  originLabel: 'Proposed — not checked',
  batchId: null,
};

const SOURCE_1 = { id: 'd1', number: 1, name: 'Source 1 — Port call register' };

const withActs = (...proposals: readonly Proposal[]): Corpus => ({
  ...CORPUS,
  entities: [VESSEL, OWNER, THIRD],
  proposals,
});

const pendingOf = (read: Corpus, entityId: string): readonly PendingLine[] => {
  const dossier = readDossier(read, entityId, [], []);
  if (dossier === null) throw new Error(`The corpus holds no entity ${entityId}`);
  return dossier.pending;
};

test('a pending deletion and a pending attribute act on a relation stand on both of its ends', () => {
  const read = withActs(
    { ...ACT, id: 'a1', op: 'delete_relation', payload: { kind: 'delete', reason: null } },
    { ...ACT, id: 'a2' },
  );

  const expected: readonly PendingLine[] = [
    {
      id: 'a1',
      summary: 'Deletes a relation',
      dissent: false,
      origin: 'extractor',
      sources: [SOURCE_1],
    },
    {
      id: 'a2',
      summary: 'Changes an attribute',
      dissent: false,
      origin: 'extractor',
      sources: [SOURCE_1],
    },
  ];
  expect(pendingOf(read, VESSEL.id)).toHaveLength(2);
  expect(pendingOf(read, VESSEL.id)).toEqual(expected);
  expect(pendingOf(read, OWNER.id)).toEqual(expected);
  expect(pendingOf(read, THIRD.id)).toEqual([]);
});

test('a pending act on a relation the record does not hold stands on no page', () => {
  const read = withActs({ ...ACT, id: 'a1', op: 'delete_relation', targetId: 'r9' });

  expect(pendingOf(read, VESSEL.id)).toEqual([]);
  expect(pendingOf(read, OWNER.id)).toEqual([]);
});

test('a pending update_relation act stands on both ends of the relation it names', () => {
  const read = withActs({
    ...ACT,
    id: 'a1',
    op: 'update_relation',
    authorRole: 'gabriel_app',
    proposer: 'operator',
  });

  const expected: readonly PendingLine[] = [
    {
      id: 'a1',
      summary: 'Changes a relation',
      dissent: false,
      origin: 'operator',
      sources: [SOURCE_1],
    },
  ];
  expect(pendingOf(read, VESSEL.id)).toEqual(expected);
  expect(pendingOf(read, OWNER.id)).toEqual(expected);
  expect(pendingOf(read, THIRD.id)).toEqual([]);
});

test('a pending end date of a relation says the day that it closes the relation', () => {
  const read = withActs({
    ...ACT,
    id: 'a1',
    op: 'update_relation',
    payload: { kind: 'close', valid_to: '2023-11-30' },
  });

  expect(pendingOf(read, VESSEL.id).map((line) => line.summary)).toEqual([
    'Closes the relation on 2023-11-30',
  ]);
});

test('a pending merge stands on the kept entity and on each absorbed entity', () => {
  const read = withActs({
    ...ACT,
    id: 'a1',
    op: 'merge_entities',
    targetKind: 'entity',
    targetId: OWNER.id,
    payload: { kind: 'merge', keep_id: null, merge_ids: [] },
    names: [VESSEL.id],
    dissent: true,
  });

  const expected: readonly PendingLine[] = [
    {
      id: 'a1',
      summary: 'Merges entities',
      dissent: true,
      origin: 'extractor',
      sources: [SOURCE_1],
    },
  ];
  expect(pendingOf(read, VESSEL.id)).toEqual(expected);
  expect(pendingOf(read, OWNER.id)).toEqual(expected);
  expect(pendingOf(read, THIRD.id)).toEqual([]);
});

test('an accepted or a rejected act is not pending', () => {
  const decided = { decidedAt: '2026-09-02T00:00:00Z', decidedBy: 'operator' };
  const read = withActs(
    { ...ACT, id: 'a1', targetKind: 'entity', targetId: VESSEL.id, status: 'accepted', ...decided },
    { ...ACT, id: 'a2', targetKind: 'entity', targetId: VESSEL.id, status: 'rejected', ...decided },
    { ...ACT, id: 'a3', status: 'accepted', ...decided },
  );

  expect(pendingOf(read, VESSEL.id)).toEqual([]);
});

const declared = (key: string, label: string, retired: boolean): EntityTypeDeclaration => ({
  key,
  label,
  colourLight: '#000000',
  colourDark: '#ffffff',
  retired,
});

test('the type choices hold the live types and the retired type the entity holds, by name', () => {
  const types = [
    declared('vessel', 'Vessel', true),
    declared('port', 'Port', false),
    declared('company', 'Company', false),
    declared('aircraft', 'Aircraft', true),
  ];

  expect(readDossier(CORPUS, VESSEL.id, types, [])?.typeChoices).toEqual([
    { key: 'company', name: 'Company' },
    { key: 'port', name: 'Port' },
    { key: 'vessel', name: 'Vessel' },
  ]);
});

test('the type choices add the held type under its own key when the vocabulary lacks it', () => {
  const types = [declared('port', 'Port', false), declared('aircraft', 'Aircraft', true)];

  expect(readDossier(CORPUS, VESSEL.id, types, [])?.typeChoices).toEqual([
    { key: 'port', name: 'Port' },
    { key: 'vessel', name: 'vessel' },
  ]);
});

test('a point borrowed from a parent that the entity list holds names that parent', () => {
  const held: Corpus = {
    ...CORPUS,
    positions: [
      {
        entityId: VESSEL.id,
        point: { lon: 4.4777, lat: 51.9244 },
        precision: 'inherited',
        area: null,
        parentId: OWNER.id,
      },
    ],
  };
  const dossier = readDossier(held, VESSEL.id, [], []);

  expect(dossier?.positionFrom).toBe(`position from ${OWNER.label}`);
});

// PU1: the origin line of the screen is the label of the public data, word for word. The record
// writes the words, so the screen adds no word and drops none, also for a group action.
test('the entity shows the label of the act that promoted it, in the words of the record', () => {
  const { op, targetKind, targetId, payload, src, names, priorValue, dissent } = ACT;
  const act = { op, targetKind, targetId, payload, src, names, priorValue, dissent };
  const promoted = (
    decidedAs: DecidedAct['decidedAs'],
    decisionOrigin: DecidedAct['decisionOrigin'],
    originLabel: string,
  ): DecidedAct => ({
    act: {
      ...act,
      id: VESSEL.promotedFrom,
      authorRole: ACT.authorRole,
      proposer: ACT.proposer,
      createdAt: ACT.createdAt,
      batchId: ACT.batchId,
    },
    verdict: 'accepted',
    decidedAt: '2026-10-08T09:30:00Z',
    decidedBy: 'operator',
    decidedAs,
    decisionOrigin,
    originLabel,
  });
  const LABELS = [
    [
      'group',
      'validated manually by the operator',
      'Validated manually by the operator, on 2026-10-08',
    ],
    [
      'rule',
      'rule strong_sources v1 (fact digits: 1)',
      'Accepted by rule strong_sources v1 — no person read it, on 2026-10-08',
    ],
    [
      'unit',
      'decided by an AI reviewer',
      'Accepted by an AI reviewer — no person read it, on 2026-10-08',
    ],
  ] as const;
  for (const [mode, origin, label] of LABELS)
    expect(readDossier(CORPUS, VESSEL.id, [], [promoted(mode, origin, label)])?.decision).toBe(
      label,
    );
  // An entity whose promotion the read does not hold says nothing of it.
  expect(readDossier(CORPUS, VESSEL.id, [], [])?.decision).toBeNull();
});
