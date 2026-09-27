import { describe, expect, it } from 'vitest';

import { corpus } from '@/shared/committed-fixture/corpus';
import type { DecidedAct } from '@/shared/read/decided-acts';
import type { Entity, Proposal } from '@/shared/read/model';

import { readDecided } from './decided';
import { readQueue } from './queue';

const TERMINAL = 'd41a7f38-2b90-4c15-8e6a-90f3b7c2d5e8';

const CREATION = '2d3e4f50-7182-49ab-c234-56789abcdef0';

const decidedOf = (proposals: readonly Proposal[]): readonly DecidedAct[] =>
  proposals.flatMap(({ status, decidedAt, decidedBy, ...act }) =>
    status === 'pending' || decidedAt === null || decidedBy === null
      ? []
      : [{ act, verdict: status, decidedAt, decidedBy }],
  );

const FIXTURE = decidedOf(corpus.proposals);

const VESSEL = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

const retyped: Proposal = {
  id: 'aa000009-0000-4000-8000-000000000002',
  op: 'update_entity',
  targetKind: 'entity',
  targetId: VESSEL,
  payload: { kind: 'columns', label: 'MV Southern Ledger', type: 'company' },
  src: ['manual'],
  names: [],
  priorValue: null,
  confidence: null,
  dissent: false,
  authorRole: 'gabriel_app',
  status: 'pending',
  createdAt: '2026-08-02T00:00:00Z',
  decidedAt: null,
  decidedBy: null,
};

describe('the history of the record', () => {
  it('lists each promotion and each rejection, the latest decision first', () => {
    const rows = readDecided(corpus, FIXTURE);
    expect(rows.map((row) => row.decidedAt)).toStrictEqual([
      '2026-07-25T07:30:00Z',
      '2026-07-22T16:20:00Z',
      '2026-07-19T18:41:00Z',
    ]);
    expect(rows.map((row) => row.verdictWords)).toStrictEqual([
      'Promoted into the record',
      'Promoted into the record',
      'Rejected in the record',
    ]);
  });

  it('says the hour in UTC to the minute, and the name that signed', () => {
    const [latest] = readDecided(corpus, FIXTURE);
    expect(latest?.when).toBe('2026-07-25 07:30 UTC');
    expect(latest?.signedAs).toBe('operator');
    expect(latest?.keys).toBe('hull_note');
  });

  it('names a deleted row from the copy the act kept of it', () => {
    const deletion: DecidedAct = {
      act: {
        id: 'aa000009-0000-4000-8000-000000000001',
        op: 'delete_entity',
        targetKind: 'entity',
        targetId: 'aa000009-0000-4000-8000-0000000000ff',
        payload: { kind: 'delete', reason: null },
        src: ['doc_9b0417'],
        names: [],
        priorValue: { kind: 'row', row: { label: 'MV Broken Hull' } },
        confidence: 0.9,
        dissent: false,
        authorRole: 'gabriel_agent',
        createdAt: '2026-08-01T00:00:00Z',
      },
      verdict: 'accepted',
      decidedAt: '2026-08-01T00:05:00Z',
      decidedBy: 'the writer door',
    };
    const [row] = readDecided(corpus, [deletion]);
    expect(row?.subject).toBe('MV Broken Hull');
    expect(row?.actWords).toBe('Deletion');
  });

  it('names a created row by the label of the row the promotion made', () => {
    const made: Entity = {
      id: 'aa000009-0000-4000-8000-0000000000aa',
      type: 'vessel',
      proposedType: null,
      label: 'MV Northern Ledger II',
      attrs: {},
      sources: ['doc_9b0417'],
      geom: null,
      promotedFrom: CREATION,
    };
    const rows = readDecided({ ...corpus, entities: [...corpus.entities, made] }, FIXTURE);
    expect(rows.find((row) => row.id === CREATION)?.subject).toBe('MV Northern Ledger II');
    expect(readDecided(corpus, FIXTURE).find((row) => row.id === CREATION)?.subject).toBe(
      'MV Northern Ledger',
    );
  });
});

describe('an act on the name and the type', () => {
  it('is named in the history by the entity it changed, and names the two columns', () => {
    const [row] = readDecided(corpus, [
      {
        act: { ...retyped, priorValue: { kind: 'row', row: { label: 'MV Northern Ledger' } } },
        verdict: 'accepted',
        decidedAt: '2026-08-02T00:05:00Z',
        decidedBy: 'the writer door',
      },
    ]);
    expect(row?.subject).toBe('MV Northern Ledger');
    expect(row?.keys).toBe('Name, Type');
    expect(row?.actWords).toBe('Change of the name or the type');
  });

  it('waits under its entity, as a change of the name and the type against the stored row', () => {
    const subjects = readQueue({ ...corpus, proposals: [retyped] }, null);
    expect(subjects.map((subject) => [subject.id, subject.kind])).toStrictEqual([[VESSEL, 'node']]);
    const [change] = subjects[0]?.changes ?? [];
    expect(change?.kind).toBe('edit');
    expect(
      change?.rows.map(({ key, op, standing, proposed }) => ({ key, op, standing, proposed })),
    ).toStrictEqual([
      { key: 'Name', op: 'edit', standing: 'MV Northern Ledger', proposed: 'MV Southern Ledger' },
      { key: 'Type', op: 'edit', standing: 'vessel', proposed: 'company' },
    ]);
  });
});

describe('the working queue', () => {
  it('holds no decided act, whatever the corpus carries', () => {
    const decidedIds = FIXTURE.map(({ act }) => act.id);
    const waiting = readQueue(corpus, null).flatMap((subject) =>
      subject.changes.map((change) => change.id),
    );
    expect(decidedIds.length).toBeGreaterThan(0);
    expect(waiting.filter((id) => decidedIds.includes(id))).toStrictEqual([]);
    expect(waiting).toContain('f0a1b2c3-4d5e-4678-9012-3456789abcde');
    expect(readQueue(corpus, null).map((subject) => subject.id)).toContain(TERMINAL);
  });
});

const BERTH = 'c3d4e5f6-9a0b-4123-c456-d7e8f90a1b2c';

const linked: Proposal = {
  ...retyped,
  id: 'aa000009-0000-4000-8000-000000000004',
  op: 'create_relation',
  targetKind: null,
  targetId: null,
  payload: {
    kind: 'relation',
    type: 'berthed_at',
    src_kind: 'entity',
    src_id: VESSEL,
    dst_kind: 'entity',
    dst_id: TERMINAL,
    valid_from: null,
    valid_to: null,
    attrs: {},
  },
};

const retagged: Proposal = {
  ...retyped,
  id: 'aa000009-0000-4000-8000-000000000005',
  op: 'update_relation',
  targetKind: 'relation',
  targetId: BERTH,
  payload: { kind: 'attrs', attrs: { observed_on: { v: '2026-06-01', src: ['doc_9b0417'] } } },
};

const queued = (act: Proposal): { readonly label: string; readonly headline: string } => {
  const [subject] = readQueue({ ...corpus, proposals: [act] }, null);
  return { label: subject?.label ?? '', headline: subject?.changes[0]?.headline ?? '' };
};

const history = (act: Proposal): string => {
  const decided: Proposal = {
    ...act,
    status: 'accepted',
    decidedAt: '2026-08-04T00:05:00Z',
    decidedBy: 'operator',
  };
  return readDecided(corpus, decidedOf([decided]))[0]?.subject ?? '';
};

describe('one act, named on the queue and in the history', () => {
  const BERTHED = 'MV Northern Ledger berthed at Maasvlakte bulk terminal, berth 7';

  it('words a proposed relation the same on both pages, and never with the raw type', () => {
    expect(queued(linked).headline).toBe(BERTHED);
    expect(history(linked)).toBe(BERTHED);
  });

  it('words a relation that stands in the record the same on both pages', () => {
    expect(queued(retagged).label).toBe(BERTHED);
    expect(history(retagged)).toBe(BERTHED);
  });

  it('says only that two entities are linked where the act names no type', () => {
    const untyped: Proposal = {
      ...linked,
      payload: {
        kind: 'relation',
        type: null,
        src_kind: 'entity',
        src_id: VESSEL,
        dst_kind: 'entity',
        dst_id: TERMINAL,
        valid_from: null,
        valid_to: null,
        attrs: {},
      },
    };
    const words = 'MV Northern Ledger is linked to Maasvlakte bulk terminal, berth 7';
    expect(queued(untyped).headline).toBe(words);
    expect(history(untyped)).toBe(words);
  });

  it('words a merge the same on both pages', () => {
    const merge: Proposal = {
      ...linked,
      op: 'merge_entities',
      payload: { kind: 'merge', keep_id: VESSEL, merge_ids: [TERMINAL] },
    };
    const words = 'Maasvlakte bulk terminal, berth 7 into MV Northern Ledger';
    expect(queued(merge).headline).toBe(words);
    expect(history(merge)).toBe(words);
  });
});

describe('the keys a promoted creation wrote', () => {
  it('names the dates and the attributes of a relation, and the location of an entity', () => {
    const decided: Pick<Proposal, 'status' | 'decidedAt' | 'decidedBy'> = {
      status: 'accepted',
      decidedAt: '2026-08-04T00:05:00Z',
      decidedBy: 'the writer door',
    };
    const dated: Proposal = {
      ...linked,
      ...decided,
      payload: {
        kind: 'relation',
        type: 'owns',
        src_kind: 'entity',
        src_id: VESSEL,
        dst_kind: 'entity',
        dst_id: TERMINAL,
        valid_from: '2019-04-01',
        valid_to: null,
        attrs: { share_pct: { v: 51, src: ['doc_9b0417'] } },
      },
    };
    const placed: Proposal = {
      ...dated,
      id: 'aa000009-0000-4000-8000-000000000006',
      op: 'create_entity',
      payload: {
        kind: 'entity',
        type: 'vessel',
        label: 'MV Placed',
        geom: { kind: 'point', point: { lon: 4, lat: 51 } },
        attrs: {},
      },
    };
    const keys = readDecided(corpus, decidedOf([dated, placed])).map((row) => row.keys);
    expect(keys.sort()).toStrictEqual(['Name, Type, Location', 'Type, Valid from, share_pct']);
  });
});

describe('who wrote a decided act', () => {
  it('carries the author of the act on its row', () => {
    const decided: Pick<Proposal, 'status' | 'decidedAt' | 'decidedBy'> = {
      status: 'accepted',
      decidedAt: '2026-08-02T00:05:00Z',
      decidedBy: 'the writer door',
    };
    const agentId = 'aa000009-0000-4000-8000-000000000003';
    const rows = readDecided(
      corpus,
      decidedOf([
        { ...retyped, ...decided },
        { ...retyped, ...decided, id: agentId, authorRole: 'gabriel_agent' },
      ]),
    );
    expect(rows.find((row) => row.id === retyped.id)?.author).toBe('operator');
    expect(rows.find((row) => row.id === agentId)?.author).toBe('machine');
  });
});
