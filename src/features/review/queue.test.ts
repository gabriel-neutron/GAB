import { describe, expect, it } from 'vitest';

import { corpus } from '@/shared/committed-fixture/corpus';
import type { Corpus, EntityTypeDeclaration, Proposal, TypeVocabulary } from '@/shared/read/model';

import { readQueue, type Change, type DifferenceRow } from './queue';

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
