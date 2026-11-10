import { expect, test } from 'vitest';

import {
  IDENTIFIER_KEY,
  IDENTIFIER_KEYS,
  identifierContainment,
  identifierKey,
  isValidImo,
  isValidRuBic,
  swiftBicOf,
} from './identifiers.ts';

// ------------------------------------------------------------- isValidImo ---

test('an imo number whose last digit is the weighted sum of the six before it is valid', () => {
  expect(isValidImo('9074729')).toBe(true);
  expect(isValidImo('9176187')).toBe(true);
});

test('an imo number whose check digit is wrong is not valid', () => {
  expect(isValidImo('9074728')).toBe(false);
  expect(isValidImo('9482137')).toBe(false);
});

test('a text that is not exactly seven digits is not valid', () => {
  for (const text of ['', '907472', '90747290', 'IMO9074729', 'IMO 9074729', ' 9074729', '907472x'])
    expect(isValidImo(text)).toBe(false);
});

// ------------------------------------------------------- the spellings ---

test('the list of spellings holds each spelling once', () => {
  expect(new Set(IDENTIFIER_KEY).size).toBe(IDENTIFIER_KEY.length);
});

test('the list of spellings and the map by entity type hold the same spellings', () => {
  const mapped = new Set(Object.values(IDENTIFIER_KEYS).flat());
  expect(mapped).toStrictEqual(new Set(IDENTIFIER_KEY));
});

test('a vessel keeps its current flag apart from its former flags', () => {
  expect(IDENTIFIER_KEYS.vessel).toEqual(expect.arrayContaining(['flag', 'flag_history']));
});

test('the schema of a spelling refuses a spelling that is not on the list', () => {
  expect(identifierKey.safeParse('imo').success).toBe(true);
  expect(identifierKey.safeParse('imo_number').success).toBe(false);
  expect(identifierKey.safeParse('IMO').success).toBe(false);
});

// ------------------------------------------------- identifierContainment ---

test('the containment holds the value as a scalar and as the element of a list', () => {
  expect(identifierContainment('imo', 'IMO 9074729')).toStrictEqual([
    { imo: { v: 'IMO 9074729' } },
    { imo: { v: ['IMO 9074729'] } },
  ]);
});

test('a value in the plain form of a number also matches that number', () => {
  expect(identifierContainment('imo', '9074729')).toStrictEqual([
    { imo: { v: '9074729' } },
    { imo: { v: ['9074729'] } },
    { imo: { v: 9074729 } },
    { imo: { v: [9074729] } },
  ]);
  expect(identifierContainment('imo', '09074729')).toHaveLength(2);
});

test('a BIC of ISO 9362 has one form: capitals, and eight characters for a head office', () => {
  expect(swiftBicOf('asanru8x')).toBe('ASANRU8X');
  expect(swiftBicOf('ASANRU8XXXX')).toBe('ASANRU8X');
  expect(swiftBicOf('ASANRU8XABC')).toBe('ASANRU8XABC');
  expect(swiftBicOf('ASANRU8')).toBeNull();
  expect(swiftBicOf('ASAN118X')).toBeNull();
  expect(swiftBicOf('044525225')).toBeNull();
});

test('a Russian BIC is exactly nine digits', () => {
  expect(isValidRuBic('044525225')).toBe(true);
  expect(isValidRuBic('44525225')).toBe(false);
  expect(isValidRuBic('ASANRU8X')).toBe(false);
});

test('the search for a head office BIC finds its two forms', () => {
  expect(identifierContainment('swift_bic', 'asanru8xxxx')).toStrictEqual([
    { swift_bic: { v: 'ASANRU8X' } },
    { swift_bic: { v: ['ASANRU8X'] } },
    { swift_bic: { v: 'ASANRU8XXXX' } },
    { swift_bic: { v: ['ASANRU8XXXX'] } },
  ]);
});
