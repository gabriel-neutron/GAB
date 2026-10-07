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
  dissent: false,
  author_role: 'gabriel_agent',
  proposer: 'extractor',
  model_call_id: null,
  status: 'pending',
  created_at: '2026-08-25T03:25:13.734752+00:00',
  decided_at: null,
  decided_by: null,
  batch_id: null,
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
      geom: null,
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
    op: 'update_entity',
    targetKind: 'entity',
    payload: { type: 'vessel' },
    read: { kind: 'columns', label: null, type: 'vessel' },
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
    read: {
      kind: 'relation',
      type: 'operates',
      src_kind: 'entity',
      src_id: SRC_ID,
      dst_kind: 'entity',
      dst_id: DST_ID,
      valid_from: null,
      valid_to: null,
      attrs: {},
    },
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

// The record refuses a new entity with no type or no name, so the read refuses one too.
test('a creation that states no name is refused', () => {
  const row = { ...PROPOSAL_ROW, op: 'create_entity', payload: { type: 'vessel' } };
  expect(() => toDomain.proposal(row)).toThrow();
});

test('the two ends of a proposed relation keep the spelling the act wrote', () => {
  const payload = toDomain.proposal(PROPOSAL_ROW).payload;
  expect(payload).toMatchObject({
    kind: 'relation',
    type: 'operates',
    src_id: '0ea482d0-cd00-4c77-911e-419dd2d1779f',
    dst_id: 'e0a8a817-0dac-49db-8627-a342609a3092',
  });
});

test('a creation keeps every key its promotion writes', () => {
  const created = (op: ProposalOp, payload: unknown): ProposalPayload =>
    toDomain.proposal({ ...PROPOSAL_ROW, op, payload }).payload;
  const point = { type: 'Point', coordinates: [4.4777, 51.9244] };
  expect(created('create_entity', { type: 'vessel', label: 'L', geom: point })).toEqual({
    kind: 'entity',
    type: 'vessel',
    label: 'L',
    geom: { kind: 'point', point: { lon: 4.4777, lat: 51.9244 } },
    attrs: {},
  });
  const area = {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  };
  expect(created('create_entity', { type: 'port', label: 'P', geom: area })).toMatchObject({
    geom: { kind: 'shape', shape: 'Polygon' },
  });
  const share = { share_pct: { v: 51, src: ['doc_8f2a41'] } };
  expect(
    created('create_relation', {
      ...PROPOSAL_ROW.payload,
      dst_kind: 'relation',
      valid_from: '2019-04-01',
      valid_to: '2021-01-31',
      attrs: share,
    }),
  ).toEqual({
    kind: 'relation',
    type: 'operates',
    src_kind: 'entity',
    src_id: SRC_ID,
    dst_kind: 'relation',
    dst_id: DST_ID,
    valid_from: '2019-04-01',
    valid_to: '2021-01-31',
    attrs: share,
  });
});

test('an act on the name or the type keeps the columns it replaced as a row', () => {
  const prior = { label: 'MV Old Name', sources: ['doc_8f2a41'] };
  const row = {
    ...PROPOSAL_ROW,
    op: 'update_entity',
    target_kind: 'entity',
    target_id: SRC_ID,
    payload: { label: 'MV New Name' },
    prior_value: prior,
    status: 'accepted',
    decided_at: '2026-08-25T03:30:00+00:00',
    decided_by: 'the writer door',
  };
  expect(toDomain.proposal(row).priorValue).toStrictEqual({ kind: 'row', row: prior });
});

const DOCUMENT_ROW = {
  id: 'doc_3c1104',
  kind: 'url',
  title: 'Corporate registry extract — Meridian Bulk Carriers Ltd',
  uri: 'https://registry.example/e',
  archive_uri: 'http://web.archive.example/e',
  sha256: null,
  mime: null,
  retrieved_at: '2026-06-02',
  created_at: '2026-08-25T03:25:13.270163+00:00',
  cost_eur: null,
};

test('a web address of a document reaches the surface as it was stored', () => {
  const read = toDomain.document(DOCUMENT_ROW);
  expect(read.uri).toBe('https://registry.example/e');
  expect(read.archiveUri).toBe('http://web.archive.example/e');
});

test('an address that is not http or https reaches the surface as no address at all', () => {
  for (const [uri, archive] of [
    ['data:text/html,x', 'javascript:alert(1)'],
    ['file:///etc/passwd', 'ms-msdt:x'],
    ['//attacker.example/x', 'www.example.org/x'],
  ]) {
    const read = toDomain.document({ ...DOCUMENT_ROW, uri, archive_uri: archive });
    expect([read.uri, read.archiveUri]).toStrictEqual([null, null]);
  }
});

const LAYOUT_ROW = { entity_id: SRC_ID, x: 412.5, y: -88.25 };

test('a stored position reaches the surface with both of its halves', () => {
  expect(toDomain.placement(LAYOUT_ROW)).toStrictEqual({
    entityId: SRC_ID,
    position: { x: 412.5, y: -88.25 },
  });
});

// Departure: a zero in place of a missing half would draw an unplaced entity at the origin.
test('a position that lacks either half, or both, is no position at all', () => {
  for (const halves of [
    { x: null, y: -88.25 },
    { x: 412.5, y: null },
    { x: null, y: null },
  ])
    expect(toDomain.placement({ ...LAYOUT_ROW, ...halves }).position).toBeNull();
});

// A row of `api.full_map`, copied whole. The view resolved the point already, so the mapper
// renames four columns and it decides nothing.
const MAP_ROW = {
  id: '94172363-dab1-4fc3-ae2a-16e3430879be',
  type: 'military_unit',
  label: '3rd Reconnaissance Company',
  geom: { type: 'Point', coordinates: [19.902, 54.65] },
  position_precision: 'inherited',
  parent_id: '0ea482d0-cd00-4c77-911e-419dd2d1779f',
};

test('a borrowed position keeps its word and names the ancestor it came from', () => {
  expect(toDomain.mapPosition(MAP_ROW)).toStrictEqual({
    entityId: '94172363-dab1-4fc3-ae2a-16e3430879be',
    point: { lon: 19.902, lat: 54.65 },
    area: null,
    precision: 'inherited',
    parentId: '0ea482d0-cd00-4c77-911e-419dd2d1779f',
  });
});

// An entity that carries a point and states no word must reach the surface with no word at all.
// A default of `exact` here would draw an unstated position as a measured one.
test('a position that states no word arrives with none, and no word is supplied for it', () => {
  const row = { ...MAP_ROW, position_precision: null, parent_id: null };
  expect(toDomain.mapPosition(row).precision).toBeNull();
  expect(toDomain.mapPosition(row).parentId).toBeNull();
});

// The view answers for every entity, and an entity nobody located and whose ancestors carry no
// point is a row with no geometry. It is not a fault, and the map draws it nowhere.
test('an entity that no walk could place arrives with no point', () => {
  expect(toDomain.mapPosition({ ...MAP_ROW, geom: null }).point).toBeNull();
});

const SQUARE_RING = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
  [0, 0],
];

test('a point arrives with no area', () => {
  expect(toDomain.mapPosition(MAP_ROW).area).toBeNull();
});

test('a polygon keeps its rings, and its point lies inside it', () => {
  const read = toDomain.mapPosition({
    ...MAP_ROW,
    geom: { type: 'Polygon', coordinates: [SQUARE_RING] },
    position_precision: null,
    parent_id: null,
  });
  expect(read.area).toStrictEqual([[SQUARE_RING]]);
  expect(read.point).toStrictEqual({ lon: 5, lat: 5 });
});

test('a multipolygon keeps every polygon, and its point lies in the largest one', () => {
  const far = [
    [20, 20],
    [21, 20],
    [21, 21],
    [20, 21],
    [20, 20],
  ];
  const read = toDomain.mapPosition({
    ...MAP_ROW,
    geom: { type: 'MultiPolygon', coordinates: [[far], [SQUARE_RING]] },
    parent_id: null,
  });
  expect(read.area).toStrictEqual([[far], [SQUARE_RING]]);
  expect(read.point).toStrictEqual({ lon: 5, lat: 5 });
});

// The view takes the point of an ancestor for a borrower, so the row is a point and the area is
// not drawn: a borrowed position stays a point.
test('a borrowed position stays a point', () => {
  const read = toDomain.mapPosition(MAP_ROW);
  expect(read.area).toBeNull();
  expect(read.parentId).not.toBeNull();
});

// A line is not drawn by this surface, and it is no position at all.
test('a line is no position at all', () => {
  const line = {
    type: 'LineString',
    coordinates: [
      [0, 0],
      [1, 1],
    ],
  };
  const read = toDomain.mapPosition({ ...MAP_ROW, geom: line });
  expect(read.point).toBeNull();
  expect(read.area).toBeNull();
});
