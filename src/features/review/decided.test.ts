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
