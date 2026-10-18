import { expect, test } from 'vitest';

import { codeVersion } from './code-version.ts';

const gitThat =
  (answers: Readonly<Record<string, string | null>>) =>
  (args: readonly string[]): string | null =>
    answers[args[0] ?? ''] ?? null;

test('a clean checkout gives the short hash of its commit', () => {
  expect(codeVersion(gitThat({ 'rev-parse': '1a7276d', status: '' }), () => '0.0.0')).toBe(
    '1a7276d',
  );
});

test('a checkout with changes gives the hash and "-dirty"', () => {
  expect(
    codeVersion(gitThat({ 'rev-parse': '1a7276d', status: ' M server.ts' }), () => '0.0.0'),
  ).toBe('1a7276d-dirty');
});

test('with no git, the version is the version of the package', () => {
  expect(codeVersion(gitThat({}), () => '0.0.0')).toBe('0.0.0');
  expect(codeVersion(gitThat({}))).toMatch(/^\d+\.\d+\.\d+/u);
});
