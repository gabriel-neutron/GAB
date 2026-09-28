import { describe, expect, it } from 'vitest';

import { corpus } from '@/shared/committed-fixture/corpus';
import type { Corpus, EntityTypeDeclaration, Proposal, TypeVocabulary } from '@/shared/read/model';

import {
  readQueue,
  sortSubjects,
  type Change,
  type DifferenceRow,
  type HoleKind,
  type SubjectKind,
} from './queue';

const TERMINAL = 'd41a7f38-2b90-4c15-8e6a-90f3b7c2d5e8';

const THRESHOLD = 0.5;

const actOf = (id: string, confidence: number | null, dissent: boolean): Proposal => ({
  id,
  op: 'update_attrs',
  targetKind: 'entity',
  targetId: TERMINAL,
  payload: { kind: 'attrs', attrs: { [`key_${id.slice(-2)}`]: { v: 1, src: ['doc_5e7730'] } } },
  src: ['doc_5e7730'],
  names: [],
  priorValue: null,
  confidence,
  dissent,
  authorRole: 'gabriel_agent',
  status: 'pending',
  createdAt: '2026-08-03T09:12:00Z',
  decidedAt: null,
  decidedBy: null,
});

const LOW_AGREED = actOf('bb000001-0000-4000-8000-000000000001', 0.4, false);
const LOW_DISSENT = actOf('bb000001-0000-4000-8000-000000000002', 0.4, true);
const HIGH_DISSENT = actOf('bb000001-0000-4000-8000-000000000003', 0.9, true);
const HIGH_AGREED = actOf('bb000001-0000-4000-8000-000000000004', 0.9, false);
const AT_THRESHOLD = actOf('bb000001-0000-4000-8000-000000000005', THRESHOLD, false);
const SILENT_AGREED = actOf('bb000001-0000-4000-8000-000000000006', null, false);
const SILENT_DISSENT = actOf('bb000001-0000-4000-8000-000000000007', null, true);

const READ: Corpus = {
  ...corpus,
  proposals: [
    LOW_AGREED,
    LOW_DISSENT,
    HIGH_DISSENT,
    HIGH_AGREED,
    AT_THRESHOLD,
    SILENT_AGREED,
    SILENT_DISSENT,
  ],
};

function changeIn(threshold: number | null, act: Proposal): Change {
  const found = readQueue(READ, threshold)
    .flatMap((subject) => subject.changes)
    .find((change) => change.id === act.id);
  if (found === undefined) throw new Error(`the queue holds no act ${act.id}`);
  return found;
}

describe('why an act stands in the queue, with a threshold in force', () => {
  it('sends a low confidence with no disagreement on the confidence alone', () => {
    expect(changeIn(THRESHOLD, LOW_AGREED).routing).toBe('low-confidence');
  });

  it('names both conditions when the agents disagreed and the confidence is low', () => {
    expect(changeIn(THRESHOLD, LOW_DISSENT).routing).toBe('both');
  });

  it('names the disagreement alone when the confidence is high', () => {
    expect(changeIn(THRESHOLD, HIGH_DISSENT).routing).toBe('dissent');
  });

  it('names neither condition when the agents agreed and the confidence is high', () => {
    expect(changeIn(THRESHOLD, HIGH_AGREED).routing).toBe('neither');
  });

  it('reads a confidence equal to the threshold as not under it', () => {
    expect(changeIn(THRESHOLD, AT_THRESHOLD).routing).toBe('neither');
  });

  it('names the disagreement of an act that states no confidence', () => {
    expect(changeIn(THRESHOLD, SILENT_DISSENT).routing).toBe('dissent');
  });

  it('never says the screen holds no threshold when the act alone states no confidence', () => {
    const change = changeIn(THRESHOLD, SILENT_AGREED);
    expect(change.routing).toBe('unstated');
    expect(change.routingWords).not.toMatch(/holds no threshold/i);
    expect(change.routingWords).toMatch(/confidence/i);
  });
});

const PORT = 'cc000001-0000-4000-8000-000000000001';

const portBackedBy = (sources: readonly string[]): Corpus => ({
  ...corpus,
  entities: [
    {
      id: PORT,
      type: 'port',
      proposedType: null,
      label: 'Old name',
      attrs: {},
      sources,
      geom: { lon: 10, lat: 50 },
      promotedFrom: 'cc000001-0000-4000-8000-0000000000ff',
    },
  ],
  proposals: [],
});

const renameCiting = (src: readonly string[]): Proposal => ({
  ...actOf('cc000001-0000-4000-8000-000000000002', 0.9, false),
  op: 'update_entity',
  targetId: PORT,
  payload: { kind: 'columns', label: 'New name', type: null },
  src,
});

function renameIn(read: Corpus, act: Proposal): Change {
  const [found] = readQueue({ ...read, proposals: [act] }, THRESHOLD).flatMap((s) => s.changes);
  if (found === undefined) throw new Error(`the queue holds no act ${act.id}`);
  return found;
}

describe('the sources of the name, the type and the location on a name change', () => {
  it('shows that the act replaces the list that also backs the location', () => {
    const change = renameIn(portBackedBy(['doc_geo']), renameCiting(['doc_new']));
    expect(change.rows.map((row) => row.key)).toEqual(['Name']);
    expect(change.rowSources?.words).toMatch(/name, the type and the map location/);
    expect(change.rowSources?.before.map((doc) => doc.id)).toEqual(['doc_geo']);
    expect(change.rowSources?.after.map((doc) => doc.id)).toEqual(['doc_new']);
  });

  it('shows no line when the act cites the list that stands', () => {
    const read = portBackedBy(['doc_geo', 'doc_new']);
    expect(renameIn(read, renameCiting(['doc_new', 'doc_geo'])).rowSources).toBeNull();
  });

  it('shows no line on an act that names attributes', () => {
    expect(renameIn(portBackedBy(['doc_geo']), actOf(PORT, 0.9, false)).rowSources).toBeNull();
  });
});

const declared = (key: string, retired: boolean): EntityTypeDeclaration => ({
  key,
  label: key,
  colourLight: '#000000',
  colourDark: '#ffffff',
  retired,
});

const VOCABULARY: TypeVocabulary = [declared('port', false), declared('vessel', true)];

const retypeTo = (type: string): Proposal => ({
  ...renameCiting(['doc_geo']),
  payload: { kind: 'columns', label: null, type },
});

const typeRowOf = (act: Proposal, types?: TypeVocabulary): DifferenceRow | undefined => {
  const read = { ...portBackedBy(['doc_geo']), proposals: [act] };
  return readQueue(read, THRESHOLD, types)
    .flatMap((subject) => subject.changes)
    .flatMap((change) => change.rows)
    .find((row) => row.key === 'Type');
};

describe('the type a promotion stores', () => {
  it('states that a word the vocabulary does not hold as live is stored as unknown', () => {
    expect(typeRowOf(retypeTo('tanker'), VOCABULARY)?.note).toMatch(/stores the type 'unknown'/);
    expect(typeRowOf(retypeTo('vessel'), VOCABULARY)?.note).toMatch(/stores the type 'unknown'/);
  });

  it('puts no mark on a live type', () => {
    const row = typeRowOf(retypeTo('port'), VOCABULARY);
    expect(row?.proposed).toBe('port');
    expect(row?.note).toBeUndefined();
  });

  it('puts no mark where no vocabulary is read', () => {
    expect(typeRowOf(retypeTo('tanker'))?.note).toBeUndefined();
  });

  it('states it on the line of a new entity', () => {
    const created: Proposal = {
      ...actOf('cc000001-0000-4000-8000-000000000003', 0.9, false),
      op: 'create_entity',
      targetKind: null,
      targetId: null,
      payload: { kind: 'entity', type: 'tanker', label: 'Probe', geom: null, attrs: {} },
    };
    const [subject] = readQueue({ ...corpus, proposals: [created] }, THRESHOLD, VOCABULARY);
    const typed = subject?.changes[0]?.rows.find((row) => row.key === 'Type');
    expect(typed?.note).toMatch(/stores the type 'unknown'/);
  });
});

const NEW_VESSEL: Proposal = {
  ...actOf('cc000001-0000-4000-8000-000000000004', 0.9, false),
  op: 'create_entity',
  targetKind: null,
  targetId: null,
  payload: {
    kind: 'entity',
    type: 'vessel',
    label: 'MV Northern Ledger',
    geom: { kind: 'point', point: { lon: 4.4777, lat: 51.9244 } },
    attrs: {},
  },
};

const CONTRADICTION = 'd4e5f60a-1b2c-4234-d567-e8f90a1b2c3d';

const NEW_OWNERSHIP: Proposal = {
  ...actOf('cc000001-0000-4000-8000-000000000005', 0.9, false),
  op: 'create_relation',
  targetKind: null,
  targetId: null,
  payload: {
    kind: 'relation',
    type: 'owns',
    src_kind: 'entity',
    src_id: TERMINAL,
    dst_kind: 'relation',
    dst_id: CONTRADICTION,
    valid_from: '2019-04-01',
    valid_to: null,
    attrs: { share_pct: { v: 51, src: ['doc_5e7730'] } },
  },
};

const onlyAct = (act: Proposal) => {
  const [subject] = readQueue({ ...corpus, proposals: [act] }, THRESHOLD);
  const change = subject?.changes[0];
  if (subject === undefined || change === undefined) throw new Error(`no act ${act.id}`);
  return { subject, change, proposed: (key: string) => change.rows.find((r) => r.key === key) };
};

describe('every value the promotion of a creation writes', () => {
  it('shows the name and the location of a new entity, and names the subject by it', () => {
    const { subject, proposed } = onlyAct(NEW_VESSEL);
    expect(subject.label).toBe('MV Northern Ledger');
    expect(proposed('Name')?.proposed).toBe('MV Northern Ledger');
    expect(proposed('Location')?.proposed).toMatch(/51\.9244.*4\.4777/);
    expect(proposed('Name')?.proposedSources.map((doc) => doc.id)).toEqual(['doc_5e7730']);
  });

  it('shows the attributes and the dates of a new relation, and no false hole', () => {
    const { change, proposed } = onlyAct(NEW_OWNERSHIP);
    expect(proposed('share_pct')?.proposed).toBe('51');
    expect(proposed('Valid from')?.proposed).toBe('2019-04-01');
    expect(proposed('Valid to')).toBeUndefined();
    expect(change.holes.map((hole) => hole.kind)).not.toContain('link-sources');
  });

  it('never calls an end that is a relation an entity absent from the record', () => {
    const { change } = onlyAct(NEW_OWNERSHIP);
    expect(change.headline).not.toMatch(/an entity absent from the record/);
    const onContradiction: Proposal = {
      ...actOf('cc000001-0000-4000-8000-000000000006', 0.9, false),
      op: 'update_relation',
      targetKind: 'relation',
      targetId: CONTRADICTION,
    };
    expect(onlyAct(onContradiction).subject.label).not.toMatch(/an entity absent/);
  });
});

describe('why an act stands in the queue, with no threshold in force', () => {
  it('names the disagreement, and states no reason for an act the agents agreed on', () => {
    expect(changeIn(null, HIGH_DISSENT).routing).toBe('dissent');
    expect(changeIn(null, LOW_AGREED).routing).toBe('unstated');
    expect(changeIn(null, LOW_AGREED).routingWords).toMatch(/threshold/i);
  });
});

describe('who wrote an act in the queue', () => {
  const OPERATOR_ACT: Proposal = {
    ...actOf('bb000001-0000-4000-8000-000000000008', 1, false),
    authorRole: 'gabriel_app',
  };

  it('marks an act of the operator as the operator, and never words it as the machine', () => {
    const [change] = readQueue({ ...corpus, proposals: [OPERATOR_ACT] }, THRESHOLD).flatMap(
      (subject) => subject.changes,
    );
    expect(change?.origin).toBe('operator');
    expect(change?.confidenceReport.words).not.toMatch(/The machine reports/);
    expect(change?.confidenceReport.words).toMatch(/operator/);
  });

  it('marks an act of an agent as the machine', () => {
    const change = changeIn(THRESHOLD, HIGH_AGREED);
    expect(change.origin).toBe('machine');
    expect(change.confidenceReport.words).toMatch(/The machine reports/);
  });
});

const TERMINAL_LABEL = 'Maasvlakte bulk terminal, berth 7';
const MERIDIAN = '3f6b1e20-9a4c-4d51-8b77-1c2e5a9d0f31';
const ABSENT = 'ee000001-0000-4000-8000-000000000001';

const onTerminal = (id: string, payload: Proposal['payload']): Proposal => ({
  ...actOf(id, 0.9, false),
  payload,
});

interface Filed {
  readonly name: string;
  readonly act: Proposal;
  readonly subject: SubjectKind;
  readonly label: string;
  readonly holes: readonly HoleKind[];
}

const FILED: readonly Filed[] = [
  {
    name: 'create_entity',
    act: NEW_VESSEL,
    subject: 'new-node',
    label: 'MV Northern Ledger',
    holes: ['duplicate'],
  },
  {
    name: 'create_relation',
    act: NEW_OWNERSHIP,
    subject: 'link',
    label: `${TERMINAL_LABEL} owns a relation, d4e5f60a`,
    holes: [],
  },
  {
    name: 'update_attrs',
    act: onTerminal('dd000001-0000-4000-8000-000000000001', {
      kind: 'attrs',
      attrs: { coal_stock_t: { v: 1, src: ['doc_5e7730'] } },
    }),
    subject: 'node',
    label: TERMINAL_LABEL,
    holes: [],
  },
  {
    name: 'update_entity',
    act: {
      ...onTerminal('dd000001-0000-4000-8000-000000000002', {
        kind: 'columns',
        label: 'New name',
        type: null,
      }),
      op: 'update_entity',
    },
    subject: 'node',
    label: TERMINAL_LABEL,
    holes: [],
  },
  {
    name: 'update_relation',
    act: {
      ...actOf('dd000001-0000-4000-8000-000000000003', 0.9, false),
      op: 'update_relation',
      targetKind: 'relation',
      targetId: CONTRADICTION,
    },
    subject: 'link',
    label: 'Meridian Bulk Carriers Ltd contradicts a relation, e1f20a34',
    holes: [],
  },
  {
    name: 'delete_entity',
    act: {
      ...onTerminal('dd000001-0000-4000-8000-000000000004', { kind: 'delete', reason: null }),
      op: 'delete_entity',
    },
    subject: 'node',
    label: TERMINAL_LABEL,
    holes: [],
  },
  {
    name: 'delete_relation',
    act: {
      ...actOf('dd000001-0000-4000-8000-000000000005', 0.9, false),
      op: 'delete_relation',
      targetKind: 'relation',
      targetId: CONTRADICTION,
      payload: { kind: 'delete', reason: null },
    },
    subject: 'link',
    label: 'Meridian Bulk Carriers Ltd contradicts a relation, e1f20a34',
    holes: [],
  },
  {
    name: 'merge_entities',
    act: {
      ...actOf('dd000001-0000-4000-8000-000000000006', 0.9, false),
      op: 'merge_entities',
      targetKind: null,
      targetId: null,
      payload: { kind: 'merge', keep_id: MERIDIAN, merge_ids: [TERMINAL] },
    },
    subject: 'merge',
    label: `${TERMINAL_LABEL} into Meridian Bulk Carriers Ltd`,
    holes: ['merge-result'],
  },
  {
    name: 'update_attrs on an absent entity',
    act: { ...actOf('dd000001-0000-4000-8000-000000000007', 0.9, false), targetId: ABSENT },
    subject: 'node',
    label: 'An entity absent from the record, ee000001',
    holes: ['absent-row'],
  },
  {
    name: 'delete_entity on an absent entity',
    act: {
      ...actOf('dd000001-0000-4000-8000-000000000008', 0.9, false),
      op: 'delete_entity',
      targetId: ABSENT,
      payload: { kind: 'delete', reason: null },
    },
    subject: 'node',
    label: 'An entity absent from the record, ee000001',
    holes: ['destroyed-row'],
  },
];

describe('the subject an act is filed under, its label and its holes', () => {
  for (const filed of FILED) {
    it(`files ${filed.name} as a ${filed.subject}, labelled from the record`, () => {
      const { subject, change } = onlyAct(filed.act);
      expect(subject.kind).toBe(filed.subject);
      expect(subject.label).toBe(filed.label);
      expect(change.holes.map((hole) => hole.kind)).toEqual(filed.holes);
    });
  }
});

const newEntity = (
  id: string,
  label: string,
  confidence: number | null,
  createdAt: string,
): Proposal => ({
  ...NEW_VESSEL,
  id,
  confidence,
  createdAt,
  payload: { kind: 'entity', type: 'vessel', label, geom: null, attrs: {} },
});

const THREE = readQueue(
  {
    ...corpus,
    proposals: [
      newEntity('dd000002-0000-4000-8000-000000000001', 'Bravo', 0.4, '2026-08-03T10:00:00Z'),
      newEntity('dd000002-0000-4000-8000-000000000002', 'Charlie', null, '2026-08-01T10:00:00Z'),
      newEntity('dd000002-0000-4000-8000-000000000003', 'Alpha', 0.7, '2026-08-02T10:00:00Z'),
    ],
  },
  THRESHOLD,
);

describe('the order of the subjects', () => {
  it('puts the weakest first, and a subject that states no confidence last', () => {
    const sorted = sortSubjects(THREE, 'confidence');
    expect(sorted.map((subject) => subject.changes[0]?.score)).toEqual([0.4, 0.7, null]);
  });

  it('puts the oldest act first', () => {
    const sorted = sortSubjects(THREE, 'oldest');
    expect(sorted.map((subject) => subject.label)).toEqual(['Charlie', 'Alpha', 'Bravo']);
  });

  it('puts the subjects in the order of their names', () => {
    const sorted = sortSubjects(THREE, 'name');
    expect(sorted.map((subject) => subject.label)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('puts the weakest act of one subject first, and an act that states no confidence last', () => {
    const [subject] = readQueue(
      {
        ...corpus,
        proposals: [
          actOf('dd000003-0000-4000-8000-000000000001', 0.7, false),
          actOf('dd000003-0000-4000-8000-000000000002', null, false),
          actOf('dd000003-0000-4000-8000-000000000003', 0.4, false),
        ],
      },
      THRESHOLD,
    );
    expect(subject?.changes.map((change) => change.score)).toEqual([0.4, 0.7, null]);
  });
});

describe('a key that is also an inherited name of an object', () => {
  it('reads constructor as a new key, with nothing standing', () => {
    const act = onTerminal('dd000004-0000-4000-8000-000000000001', {
      kind: 'attrs',
      attrs: { constructor: { v: 'x', src: ['doc_5e7730'] } },
    });
    const row = onlyAct(act).proposed('constructor');
    expect(row?.op).toBe('add');
    expect(row?.standing).toBeNull();
  });
});
