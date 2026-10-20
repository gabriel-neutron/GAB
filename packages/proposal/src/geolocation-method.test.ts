import { expect, test } from 'vitest';

import {
  GEOLOCATION_METHODS,
  GEOLOCATION_WORDS,
  isGeolocationMethod,
} from './geolocation-method.ts';
import { proposalAct } from './payload.ts';
import { writeRequest } from './request.ts';

const POINT = { type: 'Point', coordinates: [30, 60] } as const;
const ENTITY = '00000000-0000-4000-8000-000000000001';

test('each method has words for a reader, and a word outside the list is no method', () => {
  expect(Object.keys(GEOLOCATION_WORDS)).toStrictEqual([...GEOLOCATION_METHODS]);
  expect(isGeolocationMethod('satellite_match')).toBe(true);
  expect(isGeolocationMethod('guess')).toBe(false);
});

test('a new entity with a place carries the method in its payload', () => {
  const request = writeRequest.parse({
    op: 'create_entity',
    type: 'facility',
    label: 'A refinery',
    geom: POINT,
    geomMethod: 'osm_object',
  });
  expect(proposalAct(request).payload).toMatchObject({ geom: POINT, geom_method: 'osm_object' });
});

test('a place with no method takes not_stated at the door of the operator', () => {
  const request = writeRequest.parse({ op: 'update_entity', targetId: ENTITY, geom: POINT });
  expect(proposalAct(request).payload).toStrictEqual({ geom: POINT, geom_method: 'not_stated' });
});

test('an act with no place carries no method', () => {
  const request = writeRequest.parse({ op: 'update_entity', targetId: ENTITY, label: 'A name' });
  expect(proposalAct(request).payload).toStrictEqual({ label: 'A name' });
});

test('a method with no place is refused, and so is a word outside the list', () => {
  const noPlace = writeRequest.safeParse({
    op: 'update_entity',
    targetId: ENTITY,
    label: 'A',
    geomMethod: 'osm_object',
  });
  const badWord = writeRequest.safeParse({
    op: 'update_entity',
    targetId: ENTITY,
    geom: POINT,
    geomMethod: 'guess',
  });
  expect(noPlace.success).toBe(false);
  expect(badWord.success).toBe(false);
});
