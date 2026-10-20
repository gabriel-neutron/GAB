import { describe, expect, test } from 'vitest';

import { relationDefinition } from '@gab/proposal/relation-types';

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
  docType: 'other',
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
  expect(relation.cards).toEqual(
    dossier.sources.map((card) => ({
      ...card,
      holdsUp: [],
      backs: [
        {
          key: 'MV Northern Ledger owned_by Ledger Shipping',
          text: 'MV Northern Ledger owned_by Ledger Shipping',
        },
      ],
    })),
  );
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

test('a share that GEM estimated reads as an estimate on the page and in the relation panel', () => {
  const owned: Relation = {
    ...OWNED_BY,
    type: 'owns',
    srcId: OWNER.id,
    dstId: VESSEL.id,
    attrs: {
      share_pct: { v: 40.4, src: ['d1'] },
      share_imputed: { v: true, src: ['d1'] },
    },
  };
  const read: Corpus = { ...CORPUS, relations: [owned], relationTypes: [OWNS] };

  expect(readDossier(read, OWNER.id, [], [])?.relations.map((line) => line.share)).toEqual([
    'share 40.4%, estimated by GEM',
  ]);
  expect(readRelation(read, owned.id)?.share).toBe('share 40.4%, estimated by GEM');
  expect(readRelation(CORPUS, OWNED_BY.id)?.share).toBeNull();
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
        route: null,
        parentId: 'e9',
      },
    ],
  };
  const dossier = readDossier(lost, VESSEL.id, [], []);
  if (dossier === null) throw new Error('The corpus holds no vessel');

  expect(dossier.drawnOnMap).toBe(true);
  expect(dossier.positionFrom).toBe('Position borrowed from a parent (no own position recorded)');
  expect(dossier.positionChain).toEqual(['a parent']);
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

const source1 = (fact: string) => ({ id: 'd1', number: 1, fact, name: `Source 1 for: ${fact}` });

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
      sources: [source1('Deletes a relation')],
    },
    {
      id: 'a2',
      summary: 'Changes an attribute',
      dissent: false,
      origin: 'extractor',
      sources: [source1('Changes an attribute')],
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
      sources: [source1('Changes a relation')],
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

test('a pending type change of a relation says the old and the new type', () => {
  const read = withActs({
    ...ACT,
    id: 'a1',
    op: 'update_relation',
    payload: { kind: 'retype', type: 'restricted_by' },
  });

  expect(pendingOf(read, VESSEL.id).map((line) => line.summary)).toEqual([
    'Changes the type of the relation from owned_by to restricted_by',
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
      sources: [source1('Merges entities')],
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
    { key: 'vessel', name: 'Vessel' },
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
        route: null,
        parentId: OWNER.id,
      },
    ],
  };
  const dossier = readDossier(held, VESSEL.id, [], []);

  expect(dossier?.positionFrom).toBe(
    `Position borrowed from ${OWNER.label} (no own position recorded)`,
  );
});

test('the chain of parents lists each step from the unit up to the parent that gave the point', () => {
  const step = (id: string, from: string, to: string): Relation => ({
    ...OWNED_BY,
    id,
    type: 'subordinate_to',
    srcId: from,
    dstId: to,
  });
  const middle: Entity = { ...THIRD, id: 'e4', label: 'Middle' };
  const held: Corpus = {
    ...CORPUS,
    entities: [...CORPUS.entities, middle],
    relations: [step('s1', VESSEL.id, middle.id), step('s2', middle.id, OWNER.id)],
    positions: [
      {
        entityId: VESSEL.id,
        point: { lon: 4.4777, lat: 51.9244 },
        precision: 'inherited',
        area: null,
        route: null,
        parentId: OWNER.id,
      },
    ],
  };

  expect(readDossier(held, VESSEL.id, [], [])?.positionChain).toEqual(['Middle', OWNER.label]);
});

test('the chain follows the parent that gave the point and not another parent', () => {
  const step = (id: string, from: string, to: string): Relation => ({
    ...OWNED_BY,
    id,
    type: 'subordinate_to',
    srcId: from,
    dstId: to,
  });
  const other: Entity = { ...OWNER, id: 'e6', label: 'Other parent' };
  const held: Corpus = {
    ...CORPUS,
    entities: [...CORPUS.entities, other],
    relations: [step('s1', VESSEL.id, other.id), step('s2', VESSEL.id, OWNER.id)],
    positions: [
      {
        entityId: VESSEL.id,
        point: { lon: 4.4777, lat: 51.9244 },
        precision: 'inherited',
        area: null,
        route: null,
        parentId: OWNER.id,
      },
    ],
  };

  expect(readDossier(held, VESSEL.id, [], [])?.positionChain).toEqual([OWNER.label]);
});

test('the chain is the shortest path, and a missing path gives the parent alone', () => {
  const step = (id: string, from: string, to: string): Relation => ({
    ...OWNED_BY,
    id,
    type: 'subordinate_to',
    srcId: from,
    dstId: to,
  });
  const detour: Entity = { ...OWNER, id: 'e7', label: 'Detour' };
  const position = {
    entityId: VESSEL.id,
    point: { lon: 4.4777, lat: 51.9244 },
    precision: 'inherited',
    area: null,
    route: null,
    parentId: OWNER.id,
  };
  const short: Corpus = {
    ...CORPUS,
    entities: [...CORPUS.entities, detour],
    relations: [
      step('s1', VESSEL.id, detour.id),
      step('s2', detour.id, OWNER.id),
      step('s3', VESSEL.id, OWNER.id),
    ],
    positions: [position],
  };
  const lost: Corpus = { ...CORPUS, relations: [], positions: [position] };

  expect(readDossier(short, VESSEL.id, [], [])?.positionChain).toEqual([OWNER.label]);
  expect(readDossier(lost, VESSEL.id, [], [])?.positionChain).toEqual([OWNER.label]);
});

test('a ring of parents ends the chain and does not loop', () => {
  const ring = (id: string, from: string, to: string): Relation => ({
    ...OWNED_BY,
    id,
    type: 'subordinate_to',
    srcId: from,
    dstId: to,
  });
  const held: Corpus = {
    ...CORPUS,
    relations: [ring('r1', VESSEL.id, 'e5'), ring('r2', 'e5', VESSEL.id)],
    positions: [
      {
        entityId: VESSEL.id,
        point: { lon: 4.4777, lat: 51.9244 },
        precision: 'inherited',
        area: null,
        route: null,
        parentId: OWNER.id,
      },
    ],
  };

  expect(readDossier(held, VESSEL.id, [], [])?.positionChain).toEqual([OWNER.label]);
});

test('an own point has no chain of parents', () => {
  expect(readDossier(CORPUS, VESSEL.id, [], [])?.positionChain).toEqual([]);
});

test('the affiliation and the day of the newest source show as plain values', () => {
  const unit: Entity = {
    ...VESSEL,
    attrs: {
      affiliation: { v: 'Hostile', src: ['d1', 'd2'] },
      echelon: { v: 'Battalion', src: ['d3'] },
    },
  };
  const held: Corpus = {
    ...CORPUS,
    entities: [unit, ...CORPUS.entities.filter((one) => one.id !== unit.id)],
    documents: [
      { ...DOCUMENT, id: 'd1', retrievedAt: '2026-03-01T10:00:00Z' },
      { ...DOCUMENT, id: 'd2', retrievedAt: '2026-05-21' },
      { ...DOCUMENT, id: 'd3', retrievedAt: '2026-07-14' },
    ],
  };
  const dossier = readDossier(held, unit.id, [], []);

  expect(dossier?.affiliation).toBe('Hostile');
  expect(dossier?.sourceDay).toBe('2026-07-14');
  expect(readDossier(CORPUS, VESSEL.id, [], [])?.affiliation).toBeNull();
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

test('two relations that read the same still give two names and two facts', () => {
  const twin: Relation = { ...OWNED_BY, id: 'r2' };
  const read: Corpus = { ...CORPUS, relations: [OWNED_BY, twin] };
  const dossier = readDossier(read, VESSEL.id, [], []);
  if (dossier === null) throw new Error('The corpus holds no vessel');

  const names = dossier.relations.flatMap((line) => line.sources.map((ref) => ref.name));
  expect(new Set(names).size).toBe(2);
  expect(dossier.sources[0]?.backs).toHaveLength(3);
});

const cardOf = (document: DocumentRow) => {
  const dossier = readDossier({ ...CORPUS, documents: [document] }, VESSEL.id, [], []);
  const card = dossier?.sources[0];
  if (card === undefined) throw new Error('The corpus holds no card');
  return card;
};

test('a card names the kind of its document in words', () => {
  const words = (kind: DocumentRow['kind']): string | null => cardOf({ ...DOCUMENT, kind }).kind;
  expect(words('url')).toBe('Web page');
  expect(words('file')).toBe('File');
  expect(words('api')).toBe('API');
  expect(words('report')).toBe('Report');
  expect(words('manual')).toBe('Manual entry');
});

test('a cited document with no row has no kind', () => {
  const dossier = readDossier({ ...CORPUS, documents: [] }, VESSEL.id, [], []);
  expect(dossier?.sources[0]?.kind).toBeNull();
});

test('the stored import of the v1 work is marked as an import', () => {
  const v1: DocumentRow = {
    ...DOCUMENT,
    kind: 'file',
    title: 'GAB v1 ORBAT: military units and organisations of the v1 GeoPackage',
  };
  expect(cardOf(v1)).toMatchObject({ kind: 'Import', imported: true });
  expect(cardOf(DOCUMENT).imported).toBe(false);
});

test('an open interval says that no end date is recorded', () => {
  const read: Corpus = { ...CORPUS, relations: [{ ...OWNED_BY, validFrom: '2019-05-02' }] };

  expect(readDossier(read, VESSEL.id, [], [])?.relations[0]?.interval).toBe(
    'from 2019-05-02, no end date recorded',
  );
  expect(readRelation(read, OWNED_BY.id)?.interval).toBe('from 2019-05-02, no end date recorded');
});

const ISSUER: Entity = { ...VESSEL, id: 'e3', type: 'authority', label: 'OFAC', attrs: {} };
const ACT_DOCUMENT: DocumentRow = {
  ...DOCUMENT,
  id: 'd2',
  docType: 'legal_act',
  title: 'EO 14024',
  retrievedAt: '2025-03-10',
};
const DESIGNATED: Relation = {
  ...OWNED_BY,
  id: 'r2',
  type: 'designated_by',
  dstId: ISSUER.id,
  sources: ['d1', 'd2'],
  validFrom: '2024-02-23',
};
const DESIGNATION_READ: Corpus = {
  ...CORPUS,
  documents: [{ ...DOCUMENT, retrievedAt: '2024-06-01' }, ACT_DOCUMENT],
  entities: [VESSEL, OWNER, ISSUER],
  relations: [DESIGNATED],
};

test('a designation says who listed it, when, under which act, and when the status was checked', () => {
  const expected =
    'listed by OFAC on 2024-02-23 under EO 14024, no end date recorded; status checked on 2025-03-10';

  expect(readDossier(DESIGNATION_READ, VESSEL.id, [], [])?.relations[0]?.interval).toBe(expected);
  expect(readRelation(DESIGNATION_READ, DESIGNATED.id)?.interval).toBe(expected);
});

test('a designation whose sources hold no retrieval date shows no check date', () => {
  const read: Corpus = {
    ...DESIGNATION_READ,
    documents: [DOCUMENT, { ...ACT_DOCUMENT, retrievedAt: null }],
  };

  const interval = readRelation(read, DESIGNATED.id)?.interval ?? '';
  expect(interval).toBe('listed by OFAC on 2024-02-23 under EO 14024, no end date recorded');
  expect(interval).not.toMatch(/checked/);
});

test('no line says that a relation is still in force', () => {
  const words = readRelation(DESIGNATION_READ, DESIGNATED.id)?.interval ?? '';

  expect(words).not.toMatch(/in force|with no end date/);
});

const STS: RelationTypeDeclaration = {
  key: 'sts_with',
  label: 'sts with',
  inverseLabel: 'sts with',
  takesInterval: false,
  retired: false,
};

test('a relation line shows each stored fact that is not the share', () => {
  const transfer: Relation = {
    ...OWNED_BY,
    type: 'sts_with',
    attrs: {
      day: { v: '2024-03-02', src: ['d1'] },
      place: { v: 'Gulf of Laconia', src: ['d1'] },
      share_pct: { v: 10, src: ['d1'] },
    },
  };
  const read: Corpus = { ...CORPUS, relations: [transfer], relationTypes: [STS] };
  const facts = ['Day: 2024-03-02', 'Place: Gulf of Laconia'];

  expect(readDossier(read, VESSEL.id, [], [])?.relations[0]?.facts).toEqual(facts);
  expect(readRelation(read, transfer.id)?.facts).toEqual(facts);
  expect(readRelation(CORPUS, OWNED_BY.id)?.facts).toEqual([]);
});

test('a type that takes a period says so when the period is empty', () => {
  const read: Corpus = {
    ...CORPUS,
    relations: [{ ...OWNED_BY, type: 'owns' }],
    relationTypes: [OWNS],
  };
  expect(readDossier(read, VESSEL.id, [], [])?.relations[0]?.interval).toBe('period not recorded');
  expect(readRelation(read, OWNED_BY.id)?.interval).toBe('period not recorded');

  const dated: Corpus = {
    ...read,
    relations: [{ ...OWNED_BY, type: 'owns', validFrom: '2020-01-01' }],
  };
  expect(readDossier(dated, VESSEL.id, [], [])?.relations[0]?.interval).toBe(
    'from 2020-01-01, no end date recorded',
  );
});

test('a type that takes no period shows none', () => {
  const read: Corpus = {
    ...CORPUS,
    relations: [{ ...OWNED_BY, type: 'sts_with' }],
    relationTypes: [STS],
  };
  expect(readDossier(read, VESSEL.id, [], [])?.relations[0]?.interval).toBeNull();
});

test('a list value and a share that cannot be worded stay facts', () => {
  const odd: Relation = {
    ...OWNED_BY,
    attrs: {
      places: { v: ['Malta', 'Greece'], src: ['d1'] },
      share_pct: { v: 'forty', src: ['d1'] },
    },
  };
  const read: Corpus = { ...CORPUS, relations: [odd] };

  expect(readDossier(read, VESSEL.id, [], [])?.relations[0]?.facts).toEqual([
    'Places: Malta, Greece',
    'Share (%): forty',
  ]);
});

const SUBORDINATE: RelationTypeDeclaration = {
  key: 'subordinate_to',
  label: 'subordinate to',
  inverseLabel: 'is superior to',
  takesInterval: false,
  retired: false,
};

test('a relation line carries the definition of its type, and an unknown type has none', () => {
  const read: Corpus = {
    ...CORPUS,
    relations: [{ ...OWNED_BY, type: 'owns' }],
    relationTypes: [OWNS],
  };
  expect(readDossier(read, VESSEL.id, [], [])?.relations[0]?.definition).toBe(
    relationDefinition('owns'),
  );
  expect(readRelation(read, OWNED_BY.id)?.definition).toBe(relationDefinition('owns'));
  expect(readDossier(CORPUS, VESSEL.id, [], [])?.relations[0]?.definition).toBeNull();
});

test('two relations that link one pair show the type of each, and a lone relation shows none', () => {
  const lone: Corpus = {
    ...CORPUS,
    relations: [{ ...OWNED_BY, type: 'owns' }],
    relationTypes: [OWNS],
  };
  expect(readDossier(lone, VESSEL.id, [], [])?.relations[0]?.typeShown).toBeNull();

  const pair: Corpus = {
    ...CORPUS,
    relations: [
      { ...OWNED_BY, type: 'owns' },
      { ...OWNED_BY, id: 'r2', type: 'subordinate_to', srcId: OWNER.id, dstId: VESSEL.id },
    ],
    relationTypes: [OWNS, SUBORDINATE],
  };
  const lines = readDossier(pair, VESSEL.id, [], [])?.relations ?? [];
  expect(lines.map((line) => line.typeShown)).toEqual(['owns', 'is superior to']);
});

test('a vessel dossier carries the identity of the vessel and another type carries none', () => {
  const named: Entity = { ...VESSEL, attrs: { call_sign: { v: 'HP1234', src: ['d1'] } } };
  const held: Corpus = { ...CORPUS, entities: [named, OWNER] };
  const other: Corpus = { ...held, entities: [{ ...named, type: 'company' }] };

  expect(readDossier(held, named.id, [], [])?.identity).toEqual({
    flag: null,
    mmsi: null,
    callSign: 'HP1234',
  });
  expect(readDossier(other, named.id, [], [])?.identity).toBeNull();
});

describe('the flag of a vessel from its flags relations', () => {
  const state = (id: string, label: string): Entity => ({ ...OWNER, id, label });
  const flagLink = (id: string, patch: Partial<Relation>): Relation => ({
    ...OWNED_BY,
    id: `r-${id}`,
    type: 'flags',
    srcId: id,
    dstId: VESSEL.id,
    ...patch,
  });
  const flagOf = (entities: readonly Entity[], relations: readonly Relation[]) =>
    readDossier({ ...CORPUS, entities, relations }, VESSEL.id, [], [])?.identity?.flag;
  const bare: Entity = { ...VESSEL, attrs: {} };

  test('the newest open relation gives the flag in either order', () => {
    const states = [bare, state('s1', 'Comoros'), state('s2', 'Gabon')];
    const old = flagLink('s1', { validFrom: '2019-01-01' });
    const recent = flagLink('s2', { validFrom: '2023-01-01' });

    expect(flagOf(states, [old, recent])).toBe('Gabon');
    expect(flagOf(states, [recent, old])).toBe('Gabon');
  });

  test('a closed relation, a relation to another vessel and a missing state give none', () => {
    const states = [bare, state('s1', 'Comoros')];

    expect(flagOf(states, [flagLink('s1', { validTo: '2020-01-01' })])).toBeNull();
    expect(flagOf(states, [flagLink('s1', { dstId: 'other' })])).toBeNull();
    expect(flagOf(states, [flagLink('missing', {})])).toBeNull();
  });

  test('an attribute beats the relation', () => {
    const states = [VESSEL, state('s1', 'Comoros')];

    expect(flagOf(states, [flagLink('s1', {})])).toBe('Panama');
  });
});
