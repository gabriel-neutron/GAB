import { expect, test } from 'vitest';
import { z } from 'zod';

import { toDomain } from './map';
import type { Entity, ProposalOp, ProposalPayload } from './model';

// A row of the read service, copied whole. Nothing here reaches a database or a network.
const ENTITY_ROW = {
  id: '94172363-dab1-4fc3-ae2a-16e3430879be',
  type: 'vessel',
  proposed_type: null,
  label: 'MV Northern Ledger',
  geom: { type: 'Point', coordinates: [4.4777, 51.9244] },
  attrs: { imo: { v: '9482137', src: ['doc_9b0417'] } },
  sources: ['doc_9b0417', 'manual'],
  promoted_from: '5f8d5190-1df6-46b4-b6aa-8066b505c01d',
  created_at: '2026-08-25T03:25:13.270163+00:00',
  updated_at: '2026-08-25T03:25:13.270163+00:00',
};

const PROPOSAL_ROW = {
  id: '07e80431-1df2-4b32-ab9c-16f3cab6d2c7',
  op: 'create_relation',
  target_kind: null,
  target_id: null,
  payload: {
    type: 'operates',
    dst_id: 'e0a8a817-0dac-49db-8627-a342609a3092',
    src_id: '0ea482d0-cd00-4c77-911e-419dd2d1779f',
    dst_kind: 'entity',
    src_kind: 'entity',
  },
  src: ['doc_8f2a41'],
  names: [],
  prior_value: null,
  confidence: 0.41,
  dissent: false,
  author_role: 'gabriel_agent',
  status: 'pending',
  created_at: '2026-08-25T03:25:13.734752+00:00',
  decided_at: null,
  decided_by: null,
};

const SRC_ID = '0ea482d0-cd00-4c77-911e-419dd2d1779f';
const DST_ID = 'e0a8a817-0dac-49db-8627-a342609a3092';

// The mapper refuses through Zod, so the first issue names the rule that fired. A bare throw
// passes for any reason at all, and this reads the reason.
const refusalOf = (run: () => unknown): { readonly code: string; readonly path: string } => {
  try {
    run();
  } catch (cause) {
    if (!(cause instanceof z.ZodError)) throw cause;
    const issue = cause.issues[0];
    return { code: issue?.code ?? '', path: (issue?.path ?? []).map(String).join('.') };
  }
  throw new Error('the mapper accepted a row that it must refuse');
};

const entityWithAttrs = (attrs: unknown) => (): unknown =>
  toDomain.entity({ ...ENTITY_ROW, attrs });

test('an entity row becomes the entity a surface reads', () => {
  const made: Entity = {
    id: '94172363-dab1-4fc3-ae2a-16e3430879be',
    type: 'vessel',
    proposedType: null,
    label: 'MV Northern Ledger',
    attrs: { imo: { v: '9482137', src: ['doc_9b0417'] } },
    sources: ['doc_9b0417', 'manual'],
    geom: { lon: 4.4777, lat: 51.9244 },
    promotedFrom: '5f8d5190-1df6-46b4-b6aa-8066b505c01d',
  };
  expect(toDomain.entity(ENTITY_ROW)).toEqual(made);
});

test('a label that arrives null is refused, and the message names the column', () => {
  expect(() => toDomain.entity({ ...ENTITY_ROW, label: null })).toThrow(/entity\.label/);
});

test('a geometry that is not a point reaches the surface as no position at all', () => {
  const line = { type: 'LineString', coordinates: [[4.4777, 51.9244]] };
  expect(toDomain.entity({ ...ENTITY_ROW, geom: line }).geom).toBeNull();
  expect(toDomain.entity(ENTITY_ROW).geom).toEqual({ lon: 4.4777, lat: 51.9244 });
});

test('an attribute that states no sources at all is refused, and the issue names src', () => {
  expect(refusalOf(entityWithAttrs({ imo: { v: '9482137' } }))).toEqual({
    code: 'invalid_type',
    path: 'imo.src',
  });
});

test('an attribute that carries a key beside the value and the sources is refused', () => {
  const extra = { imo: { v: '9482137', src: ['doc_9b0417'], note: 'no' } };
  expect(refusalOf(entityWithAttrs(extra))).toEqual({ code: 'unrecognized_keys', path: 'imo' });
});

test('an attribute that states an empty list of sources is refused', () => {
  const empty = { imo: { v: '9482137', src: [] } };
  expect(refusalOf(entityWithAttrs(empty))).toEqual({ code: 'too_small', path: 'imo.src' });
});

// A create act names no target, so the two target columns stay null on that row. The database
// writes the target only for an act that edits or removes a row that exists.
const ACTS: readonly {
  readonly op: ProposalOp;
  readonly targetKind: 'entity' | 'relation' | null;
  readonly payload: unknown;
  readonly read: ProposalPayload;
}[] = [
  {
    op: 'create_entity',
    targetKind: null,
    payload: {
      type: 'vessel',
      label: 'MV Northern Ledger',
      attrs: { imo: { v: '9482137', src: ['doc_9b0417'] } },
    },
    read: {
      kind: 'entity',
      type: 'vessel',
      label: 'MV Northern Ledger',
      attrs: { imo: { v: '9482137', src: ['doc_9b0417'] } },
    },
  },
  {
    op: 'update_attrs',
    targetKind: 'entity',
    payload: { attrs: { coal_stock_t: { v: 41200, src: ['doc_8f2a41'] } } },
    read: { kind: 'attrs', attrs: { coal_stock_t: { v: 41200, src: ['doc_8f2a41'] } } },
  },
  {
    op: 'delete_entity',
    targetKind: 'entity',
    payload: { reason: 'the row repeats another row' },
    read: { kind: 'delete', reason: 'the row repeats another row' },
  },
  {
    op: 'create_relation',
    targetKind: null,
    payload: { type: 'operates', src_id: SRC_ID, dst_id: DST_ID },
    read: { kind: 'relation', type: 'operates', src_id: SRC_ID, dst_id: DST_ID },
  },
  {
    // The promotion reads `payload->'attrs'` for this act, in the branch of `update_attrs`, so
    // the payload is an attribute object and the ends stand on the relation the act names.
    op: 'update_relation',
    targetKind: 'relation',
    payload: { attrs: { berth: { v: 'Quay 7', src: ['doc_8f2a41'] } } },
    read: { kind: 'attrs', attrs: { berth: { v: 'Quay 7', src: ['doc_8f2a41'] } } },
  },
  {
    op: 'delete_relation',
    targetKind: 'relation',
    payload: {},
    read: { kind: 'delete', reason: null },
  },
  {
    op: 'merge_entities',
    targetKind: 'entity',
    payload: { keep_id: SRC_ID, merge_ids: [DST_ID] },
    read: { kind: 'merge', keep_id: SRC_ID, merge_ids: [DST_ID] },
  },
];

test('each operation reads its own payload, and states what the act holds', () => {
  for (const act of ACTS) {
    const row = {
      ...PROPOSAL_ROW,
      op: act.op,
      target_kind: act.targetKind,
      target_id: act.targetKind === null ? null : SRC_ID,
      payload: act.payload,
    };
    expect(toDomain.proposal(row).payload).toEqual(act.read);
  }
});

test('a payload that states no value at all reaches the surface as an absence', () => {
  const row = { ...PROPOSAL_ROW, op: 'create_entity', payload: {} };
  expect(toDomain.proposal(row).payload).toEqual({
    kind: 'entity',
    type: null,
    label: null,
    attrs: {},
  });
});

test('the two ends of a proposed relation keep the spelling the act wrote', () => {
  const payload = toDomain.proposal(PROPOSAL_ROW).payload;
  expect(payload).toEqual({
    kind: 'relation',
    type: 'operates',
    src_id: '0ea482d0-cd00-4c77-911e-419dd2d1779f',
    dst_id: 'e0a8a817-0dac-49db-8627-a342609a3092',
  });
});

test('an act that states no confidence survives the mapper', () => {
  expect(toDomain.proposal({ ...PROPOSAL_ROW, confidence: null }).confidence).toBeNull();
});
