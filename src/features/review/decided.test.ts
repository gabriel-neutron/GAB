import { describe, expect, it } from 'vitest';

import { corpus } from '@/shared/committed-fixture/corpus';
import type { DecidedAct } from '@/shared/read/decided-acts';
import type { Entity, Proposal } from '@/shared/read/model';

import { readDecided } from './decided';

const TERMINAL = 'd41a7f38-2b90-4c15-8e6a-90f3b7c2d5e8';

const CREATION = '2d3e4f50-7182-49ab-c234-56789abcdef0';

const decidedOf = (proposals: readonly Proposal[]): readonly DecidedAct[] =>
  proposals.flatMap(({ status, decidedAt, decidedBy, decidedAs, ...act }) =>
    status !== 'accepted' || decidedAt === null || decidedBy === null
      ? []
      : [{ act, verdict: status, decidedAt, decidedBy, decidedAs }],
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
  dissent: false,
  authorRole: 'gabriel_app',
  proposer: 'operator',
  status: 'pending',
  createdAt: '2026-08-02T00:00:00Z',
  decidedAt: null,
  decidedBy: null,
  decidedAs: null,
  batchId: null,
};

describe('the history of the record', () => {
  it('lists each promotion, the latest decision first', () => {
    const rows = readDecided(corpus, FIXTURE);
    expect(rows.map((row) => row.decidedAt)).toStrictEqual([
      '2026-07-25T07:30:00Z',
      '2026-07-22T16:20:00Z',
    ]);
    expect(rows.map((row) => row.verdictWords)).toStrictEqual([
      'Promoted into the record',
      'Promoted into the record',
    ]);
  });

  it('says the hour in UTC to the minute, and the name that signed', () => {
    const [latest] = readDecided(corpus, FIXTURE);
    expect(latest?.when).toBe('2026-07-25 07:30 UTC');
    expect(latest?.signedAs).toBe('operator');
    expect(latest?.keys).toBe('hull_note');
  });

  it('says who decided each act, and names a group action', () => {
    const [first] = FIXTURE;
    if (first === undefined) throw new Error('the fixture holds no decided act');
    const how = (decidedAs: DecidedAct['decidedAs']): string | undefined =>
      readDecided(corpus, [{ ...first, decidedAs }])[0]?.decidedHow;
    expect((['unit', 'relation', 'group', null] as const).map(how)).toStrictEqual([
      'the operator',
      'the operator',
      'the operator, group action',
      'the operator',
    ]);
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
        dissent: false,
        authorRole: 'gabriel_agent',
        proposer: 'extractor',
        createdAt: '2026-08-01T00:00:00Z',
        batchId: null,
      },
      verdict: 'accepted',
      decidedAt: '2026-08-01T00:05:00Z',
      decidedBy: 'the writer door',
      decidedAs: 'unit',
    };
    const [row] = readDecided(corpus, [deletion]);
    expect(row?.subject).toBe('MV Broken Hull');
    expect(row?.actWords).toBe('Deletion');
  });

  it('names a deleted relation from the type and the ends the act kept of it', () => {
    const cut = (row: Readonly<Record<string, unknown>>): string =>
      readDecided(corpus, [
        {
          act: {
            id: 'aa000009-0000-4000-8000-000000000007',
            op: 'delete_relation',
            targetKind: 'relation',
            targetId: 'aa000009-0000-4000-8000-0000000000ee',
            payload: { kind: 'delete', reason: null },
            src: ['doc_9b0417'],
            names: [],
            priorValue: { kind: 'row', row },
            dissent: false,
            authorRole: 'gabriel_app',
            proposer: 'operator',
            createdAt: '2026-08-01T00:00:00Z',
            batchId: null,
          },
          verdict: 'accepted',
          decidedAt: '2026-08-01T00:05:00Z',
          decidedBy: 'operator',
          decidedAs: 'unit',
        },
      ])[0]?.subject ?? '';
    const ends = { src_kind: 'entity', src_id: VESSEL, dst_kind: 'entity', dst_id: TERMINAL };
    expect(cut({ ...ends, type: 'owns' })).toBe(
      'MV Northern Ledger owns Maasvlakte bulk terminal, berth 7',
    );
    expect(cut({ src_id: VESSEL, dst_id: TERMINAL, type: 'owns' })).toBe(
      'MV Northern Ledger owns Maasvlakte bulk terminal, berth 7',
    );
    expect(cut({ ...ends, dst_kind: 'relation', dst_id: BERTH, type: 'owns' })).toBe(
      'MV Northern Ledger owns a relation, c3d4e5f6',
    );
    expect(cut({ ...ends, type: null })).toBe('A relation absent from the record, aa000009');
    expect(cut({ type: 'owns', src_id: VESSEL })).toBe(
      'A relation absent from the record, aa000009',
    );
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
        decidedAs: 'unit',
      },
    ]);
    expect(row?.subject).toBe('MV Northern Ledger');
    expect(row?.keys).toBe('Name, Type');
    expect(row?.actWords).toBe('Change of the name or the type');
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

const history = (act: Proposal): string => {
  const decided: Proposal = {
    ...act,
    status: 'accepted',
    decidedAt: '2026-08-04T00:05:00Z',
    decidedBy: 'operator',
  };
  return readDecided(corpus, decidedOf([decided]))[0]?.subject ?? '';
};

describe('one act, named in the history', () => {
  const BERTHED = 'MV Northern Ledger berthed at Maasvlakte bulk terminal, berth 7';

  it('words a proposed relation with the words of its type, and never with the raw type', () => {
    expect(history(linked)).toBe(BERTHED);
  });

  it('words a relation that stands in the record by its type and its ends', () => {
    expect(history(retagged)).toBe(BERTHED);
  });

  it('words a merge by the entity it keeps', () => {
    const merge: Proposal = {
      ...linked,
      op: 'merge_entities',
      payload: { kind: 'merge', keep_id: VESSEL, merge_ids: [TERMINAL] },
    };
    const words = 'Maasvlakte bulk terminal, berth 7 into MV Northern Ledger';
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
  it('names the proposer of the act on its row, and never a machine', () => {
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
        { ...retyped, ...decided, id: agentId, authorRole: 'gabriel_agent', proposer: 'extractor' },
      ]),
    );
    expect(rows.find((row) => row.id === retyped.id)?.author).toBe('operator');
    expect(rows.find((row) => row.id === agentId)?.author).toBe('extractor');
  });
});
