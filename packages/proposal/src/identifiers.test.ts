import { expect, test } from 'vitest';

import {
  IDENTIFIER_KEY,
  IDENTIFIER_KEYS,
  identifierContainment,
  identifierKey,
  isValidImo,
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

test('the schema of a spelling refuses a spelling that is not on the list', () => {
  expect(identifierKey.safeParse('imo').success).toBe(true);
  expect(identifierKey.safeParse('imo_number').success).toBe(false);
  expect(identifierKey.safeParse('IMO').success).toBe(false);
});

// ------------------------------------------------- identifierContainment ---

test('the containment holds the value as a scalar and as the element of a list', () => {
  expect(identifierContainment('imo', '9074729')).toStrictEqual({
    scalar: { imo: { v: '9074729' } },
    element: { imo: { v: ['9074729'] } },
  });
});
