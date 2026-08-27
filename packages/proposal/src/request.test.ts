import { expect, test } from 'vitest';

import { writeRequest } from './request.ts';
import { ATTRIBUTE_KIND, type AttributeVocabulary } from './vocabulary.ts';

const VOCABULARY: AttributeVocabulary = [
  { key: 'coal_stock_t', kind: ATTRIBUTE_KIND.quantity, pattern: null, retired: false },
];

const body = writeRequest(VOCABULARY);

const SRC_ID = '0ea482d0-cd00-4c77-911e-419dd2d1779f';
const DST_ID = 'e0a8a817-0dac-49db-8627-a342609a3092';

const relation = (given: Readonly<Record<string, unknown>>): unknown => ({
  op: 'create_relation',
  type: 'berthed_at',
  srcId: SRC_ID,
  dstId: DST_ID,
  ...given,
});

const messageOf = (given: unknown): string => {
  const held = body.safeParse(given);
  if (held.success) throw new Error('the request accepted a body that it must refuse');
  return held.error.issues[0]?.message ?? '';
};

// A refusal that says no more than "it failed" also passes on the day another rule fires. The
// code and the path together name the one rule under test.
const faultOf = (given: unknown): { readonly code: string; readonly path: string } => {
  const held = body.safeParse(given);
  if (held.success) throw new Error('the request accepted a body that it must refuse');
  const issue = held.error.issues[0];
  return { code: issue?.code ?? '', path: (issue?.path ?? []).join('.') };
};

const INTERVAL_RULE = 'an interval belongs to one of owns, operates, flags, insures, appoints';

test('a relation that states identity or control takes an interval', () => {
  const held = body.safeParse(relation({ type: 'operates', validFrom: '2026-01-01' }));
  expect(held.success).toBe(true);
});

test('a relation of another type takes no interval, and the sentence lists the five', () => {
  expect(messageOf(relation({ validFrom: '2026-01-01' }))).toBe(INTERVAL_RULE);
  expect(messageOf(relation({ validTo: '2026-12-31' }))).toBe(INTERVAL_RULE);
});

test('a relation of another type with no interval at all is accepted', () => {
  expect(body.safeParse(relation({})).success).toBe(true);
});

test('a day that is not written as a day is refused, and the interval rule stands', () => {
  expect(faultOf(relation({ type: 'owns', validFrom: '1 January 2026' }))).toStrictEqual({
    code: 'invalid_format',
    path: 'validFrom',
  });
});

test('an endpoint that is not an identifier is refused, and the refusal names the end', () => {
  expect(faultOf(relation({ srcId: 'the northern ledger' }))).toStrictEqual({
    code: 'invalid_format',
    path: 'srcId',
  });
});

test('an endpoint kind that nobody states is read as an entity', () => {
  const held = body.parse(relation({}));
  expect(held).toMatchObject({ srcKind: 'entity', dstKind: 'entity' });
});

const entity = (geom: unknown): unknown => ({
  op: 'create_entity',
  type: 'facility',
  label: 'Quay 7',
  geom,
});

const GEOMETRIES: readonly (readonly [string, unknown])[] = [
  ['Point', { type: 'Point', coordinates: [4.05, 51.95] }],
  ['MultiPoint', { type: 'MultiPoint', coordinates: [[4.05, 51.95]] }],
  [
    'LineString',
    {
      type: 'LineString',
      coordinates: [
        [4.05, 51.95],
        [4.06, 51.96],
      ],
    },
  ],
  ['MultiLineString', { type: 'MultiLineString', coordinates: [[[4.05, 51.95]]] }],
  ['Polygon', { type: 'Polygon', coordinates: [[[4.05, 51.95]]] }],
  ['MultiPolygon', { type: 'MultiPolygon', coordinates: [[[[4.05, 51.95]]]] }],
];

test('each of the six geometries the union states is accepted', () => {
  for (const [name, geom] of GEOMETRIES)
    expect({ name, ok: body.safeParse(entity(geom)).success }).toEqual({ name, ok: true });
});

test('a geometry the union does not state is refused by its type', () => {
  expect(faultOf(entity({ type: 'Circle', coordinates: [4.05, 51.95] }))).toStrictEqual({
    code: 'invalid_union',
    path: 'geom.type',
  });
});

test('a position of one number is refused, and a height is accepted', () => {
  expect(faultOf(entity({ type: 'Point', coordinates: [4.05] }))).toStrictEqual({
    code: 'too_small',
    path: 'geom.coordinates',
  });
  expect(body.safeParse(entity({ type: 'Point', coordinates: [4.05, 51.95, 3] })).success).toBe(
    true,
  );
});

test('a geometry that carries a key beside the type and the coordinates is refused', () => {
  const extra = { type: 'Point', coordinates: [4.05, 51.95], crs: 'EPSG:4326' };
  expect(faultOf(entity(extra))).toStrictEqual({ code: 'unrecognized_keys', path: 'geom' });
});

test('the act comes from the address, and a body that states another act is refused', () => {
  expect(faultOf({ op: 'merge_entities', keepId: SRC_ID })).toStrictEqual({
    code: 'invalid_union',
    path: 'op',
  });
});
