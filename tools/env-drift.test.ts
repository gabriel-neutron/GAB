// A variable that the example adds and the real file lacks must stop the run once, by its name,
// and never as one failure in each test that reaches the service behind it. The test reads text
// and opens no socket.

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from 'vitest';

import { assertNoEnvDrift, envDriftSentence, missingNames } from './env-drift.ts';

const EXAMPLE = 'A=\nB=\n# C=\n';
const ACTUAL = 'A=a-held-secret\n';

test('the drift names a variable that the example sets and the real file lacks', () => {
  expect(missingNames(EXAMPLE, ACTUAL)).toEqual(['B']);
});

test('the drift sentence names the missing variable, and no other name and no value', () => {
  const sentence = envDriftSentence(missingNames(EXAMPLE, ACTUAL));

  expect(sentence).toMatch(/\bB\b/u);
  expect(sentence).not.toMatch(/\bA\b/u);
  expect(sentence).not.toMatch(/\bC\b/u);
  expect(sentence).not.toContain('a-held-secret');
});

test('the run stops on the drift of infra/.env, and it goes on when no name is missing', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'env-drift-'));
  mkdirSync(path.join(root, 'infra'));
  writeFileSync(path.join(root, 'infra', '.env.example'), EXAMPLE);
  writeFileSync(path.join(root, 'infra', '.env'), ACTUAL);

  expect(() => {
    assertNoEnvDrift(root);
  }).toThrow(/\bB\b/u);

  writeFileSync(path.join(root, 'infra', '.env'), `${ACTUAL}B=b-held-secret\n`);
  expect(() => {
    assertNoEnvDrift(root);
  }).not.toThrow();
});
