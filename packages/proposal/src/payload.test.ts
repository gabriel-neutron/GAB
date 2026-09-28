import { expect, test } from 'vitest';

import { proposalAct } from './payload.ts';

const TARGET = '0ea482d0-cd00-4c77-911e-419dd2d1779f';
const OTHER = '5b1f0c2e-7a44-4d0b-9c3e-2f6d8a1e4b90';

test('an act on the name and the type carries only the column it changes', () => {
  expect(
    proposalAct({ op: 'update_entity', targetId: TARGET, type: 'vessel' }, null),
  ).toStrictEqual({
    ready: true,
    act: {
      op: 'update_entity',
      payload: { type: 'vessel' },
      src: ['manual'],
      names: [],
      targetKind: 'entity',
      targetId: TARGET,
    },
  });
});

test('an act on the name and the type carries both columns when it changes both', () => {
  expect(
    proposalAct(
      { op: 'update_entity', targetId: TARGET, label: 'MV Northern Star', type: 'vessel' },
      null,
    ),
  ).toStrictEqual({
    ready: true,
    act: {
      op: 'update_entity',
      payload: { label: 'MV Northern Star', type: 'vessel' },
      src: ['manual'],
      names: [],
      targetKind: 'entity',
      targetId: TARGET,
    },
  });
});

const cited = (prior: unknown, v: string | readonly string[]) =>
  proposalAct(
    {
      op: 'update_attrs',
      targetKind: 'entity',
      targetId: TARGET,
      attrs: { imo: { v: typeof v === 'string' ? v : [...v] } },
    },
    prior,
  );

test('a changed value cites the operator alone, and the act cites nothing else', () => {
  expect(cited({ imo: { v: '9482137', src: ['doc_a'] } }, '9482138')).toMatchObject({
    ready: true,
    act: { payload: { attrs: { imo: { v: '9482138', src: ['manual'] } } }, src: ['manual'] },
  });
});

test('an unchanged value keeps every document it cites, and adds the operator', () => {
  expect(cited({ imo: { v: '9482137', src: ['doc_a'] } }, '9482137')).toMatchObject({
    ready: true,
    act: {
      payload: { attrs: { imo: { v: '9482137', src: ['doc_a', 'manual'] } } },
      src: ['manual', 'doc_a'],
    },
  });
});

test('a list in the same order is unchanged, and a list in another order is changed', () => {
  const prior = { imo: { v: ['a', 'b'], src: ['doc_a'] } };
  expect(cited(prior, ['a', 'b'])).toMatchObject({
    act: { payload: { attrs: { imo: { src: ['doc_a', 'manual'] } } } },
  });
  expect(cited(prior, ['b', 'a'])).toMatchObject({
    act: { payload: { attrs: { imo: { src: ['manual'] } } } },
  });
});

test('a key the target does not hold cites the operator alone', () => {
  expect(cited({}, '9482137')).toMatchObject({
    act: { payload: { attrs: { imo: { v: '9482137', src: ['manual'] } } } },
  });
});

test('a prior that does not parse refuses the act, and never becomes an empty citation', () => {
  for (const prior of ['x', { imo: { v: '9482137', src: 'doc_a' } }, { imo: { src: ['doc_a'] } }])
    expect(cited(prior, '9482137')).toStrictEqual({
      ready: false,
      refusal: 'the writer cannot read the attributes the target holds, and it writes nothing',
    });
});

const BRUSSELS: [number, number] = [4.35, 50.85];

const POINT = { type: 'Point' as const, coordinates: BRUSSELS };

test.each([
  {
    name: 'an entity with no position carries no geom key',
    request: { op: 'create_entity' as const, type: 'vessel', label: 'MV Aurora' },
    act: {
      op: 'create_entity',
      payload: { type: 'vessel', label: 'MV Aurora', attrs: {}, sources: ['manual'] },
      src: ['manual'],
      names: [],
      targetKind: null,
      targetId: null,
    },
  },
  {
    name: 'an entity with a position and a value carries both, and the value cites the operator',
    request: {
      op: 'create_entity' as const,
      type: 'port',
      label: 'Antwerp',
      geom: POINT,
      attrs: { unlocode: { v: 'BEANR' } },
    },
    act: {
      op: 'create_entity',
      payload: {
        type: 'port',
        label: 'Antwerp',
        geom: POINT,
        attrs: { unlocode: { v: 'BEANR', src: ['manual'] } },
        sources: ['manual'],
      },
      src: ['manual'],
      names: [],
      targetKind: null,
      targetId: null,
    },
  },
  {
    name: 'a relation with no interval names its two ends and carries no interval key',
    request: {
      op: 'create_relation' as const,
      type: 'calls_at',
      srcKind: 'entity' as const,
      srcId: TARGET,
      dstKind: 'entity' as const,
      dstId: OTHER,
    },
    act: {
      op: 'create_relation',
      payload: {
        type: 'calls_at',
        src_kind: 'entity',
        src_id: TARGET,
        dst_kind: 'entity',
        dst_id: OTHER,
        attrs: {},
        sources: ['manual'],
      },
      src: ['manual'],
      names: [TARGET, OTHER],
      targetKind: null,
      targetId: null,
    },
  },
  {
    name: 'a relation with an interval carries each end of it that the request states',
    request: {
      op: 'create_relation' as const,
      type: 'owns',
      srcKind: 'entity' as const,
      srcId: TARGET,
      dstKind: 'relation' as const,
      dstId: OTHER,
      validFrom: '2024-01-01',
      validTo: '2025-06-30',
    },
    act: {
      op: 'create_relation',
      payload: {
        type: 'owns',
        src_kind: 'entity',
        src_id: TARGET,
        dst_kind: 'relation',
        dst_id: OTHER,
        valid_from: '2024-01-01',
        valid_to: '2025-06-30',
        attrs: {},
        sources: ['manual'],
      },
      src: ['manual'],
      names: [TARGET, OTHER],
      targetKind: null,
      targetId: null,
    },
  },
  {
    name: 'a delete of an entity carries an empty payload and names the entity',
    request: { op: 'delete_entity' as const, targetId: TARGET },
    act: {
      op: 'delete_entity',
      payload: {},
      src: ['manual'],
      names: [],
      targetKind: 'entity',
      targetId: TARGET,
    },
  },
  {
    name: 'a delete of a relation carries an empty payload and names the relation',
    request: { op: 'delete_relation' as const, targetId: TARGET },
    act: {
      op: 'delete_relation',
      payload: {},
      src: ['manual'],
      names: [],
      targetKind: 'relation',
      targetId: TARGET,
    },
  },
])('$name', ({ request, act }) => {
  expect(proposalAct(request, null)).toStrictEqual({ ready: true, act });
});
