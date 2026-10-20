import { expect, test } from 'vitest';

import type { Attributes } from '@/shared/read/model';

import { vesselIdentity } from './vessel-identity';

const held = (values: Readonly<Record<string, string | readonly string[]>>): Attributes =>
  Object.fromEntries(Object.entries(values).map(([key, v]) => [key, { v, src: [] }]));

const identityOf = (
  values: Readonly<Record<string, string | readonly string[]>>,
  openFlag: string | null = null,
) => vesselIdentity('vessel', held(values), openFlag);

test('a vessel with the three values gives each of them', () => {
  expect(identityOf({ flag: 'Panama', mmsi_history: '352001234', call_sign: 'HP1234' })).toEqual({
    flag: 'Panama',
    mmsi: '352001234',
    callSign: 'HP1234',
  });
});

test('a vessel without a value gives null for it', () => {
  expect(identityOf({})).toEqual({ flag: null, mmsi: null, callSign: null });
});

test('the current value of a history is its last element', () => {
  expect(
    identityOf({ flag_history: ['Comoros', 'Gabon'], mmsi_history: ['111111111', '222222222'] }),
  ).toMatchObject({ flag: 'Gabon', mmsi: '222222222' });
});

test('a history that is a JSON list in text gives its last element', () => {
  expect(identityOf({ flag_history: '["Comoros","Gabon"]' })).toMatchObject({ flag: 'Gabon' });
});

test('a flag key beats the history of flags', () => {
  expect(identityOf({ flag: 'Panama', flag_history: ['Comoros'] })).toMatchObject({
    flag: 'Panama',
  });
});

test('a flag relation with no end gives the flag when no attribute does', () => {
  expect(identityOf({}, 'Gabon')).toMatchObject({ flag: 'Gabon' });
  expect(identityOf({ flag: 'Panama' }, 'Gabon')).toMatchObject({ flag: 'Panama' });
});

test('an empty text or an empty list gives null', () => {
  expect(identityOf({ call_sign: '  ', mmsi_history: [] })).toMatchObject({
    callSign: null,
    mmsi: null,
  });
});

test('an entity that is no vessel has no identity', () => {
  expect(vesselIdentity('company', held({ call_sign: 'X1' }), null)).toBeNull();
});
