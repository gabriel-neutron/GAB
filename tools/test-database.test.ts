// The guard that keeps a test run off the published record. It reads a plain object and opens no
// socket, so it runs on every machine.

import { expect, test } from 'vitest';

import { chosenDatabase, testRunDatabase } from './test-database.ts';

test('a test run reaches the test database when the environment names none', () => {
  expect(testRunDatabase({})).toBe('gabriel_test');
  expect(testRunDatabase({ GABRIEL_DATABASE: 'gabriel_test' })).toBe('gabriel_test');
});

test('a test run refuses to start against the published record', () => {
  expect(() => testRunDatabase({ GABRIEL_DATABASE: 'gabriel' })).toThrow(/gabriel_test/);
});

test('a test run refuses a database name outside the closed set', () => {
  expect(() => testRunDatabase({ GABRIEL_DATABASE: 'postgres' })).toThrow(/gabriel_test/);
});

test('a command reaches the published record when the environment names no database', () => {
  expect(chosenDatabase({})).toBe('gabriel');
  expect(chosenDatabase({ GABRIEL_DATABASE: 'gabriel_test' })).toBe('gabriel_test');
  expect(() => chosenDatabase({ GABRIEL_DATABASE: 'gabriel2' })).toThrow(/GABRIEL_DATABASE/);
});
