// The merge guard hook must refuse each merge that does not target `staging`. This test calls the
// pure function of the hook with fake commands and a fake base reader. It never runs gh.

import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

type Verdict = { allow: boolean };
type Guard = {
  decide: (command: string, readBase: (selector: string | null) => string | null) => Verdict;
};

const require = createRequire(import.meta.url);
const guard = require(
  path.resolve(import.meta.dirname, '../.claude/hooks/merge_base_guard.cjs'),
) as Guard;

const asked: (string | null)[] = [];
const baseIs =
  (base: string | null) =>
  (selector: string | null): string | null => {
    asked.push(selector);
    return base;
  };

describe('commands that are not a merge', () => {
  test.each(['git status', 'gh pr view 12', 'gh pr checks 12', 'echo done'])('%s', (command) => {
    expect(guard.decide(command, baseIs(null)).allow).toBe(true);
  });
});

describe('a merge into staging', () => {
  test.each([
    'gh pr merge 12 --auto --merge',
    'gh pr merge --auto --merge 12',
    'gh pr merge https://github.com/example/repo/pull/12 --merge',
    'gh pr merge my-branch --auto --merge',
    'gh pr merge --auto --merge',
    'gh pr merge --subject "a b" --body "c" 12',
  ])('%s', (command) => {
    expect(guard.decide(command, baseIs('staging')).allow).toBe(true);
  });

  test('the selector comes from any position', () => {
    asked.length = 0;
    guard.decide('gh pr merge --auto --merge 12', baseIs('staging'));
    guard.decide('gh pr merge https://github.com/example/repo/pull/12', baseIs('staging'));
    guard.decide('gh pr merge my-branch --merge', baseIs('staging'));
    guard.decide('gh pr merge --subject "a b" 12', baseIs('staging'));
    guard.decide('gh pr merge --auto', baseIs('staging'));
    expect(asked).toEqual([
      '12',
      'https://github.com/example/repo/pull/12',
      'my-branch',
      '12',
      null,
    ]);
  });
});

describe('a merge that stays refused', () => {
  test('the base is main', () => {
    expect(guard.decide('gh pr merge 12 --merge', baseIs('main')).allow).toBe(false);
  });

  test('the base cannot be read', () => {
    expect(guard.decide('gh pr merge 12 --merge', baseIs(null)).allow).toBe(false);
    expect(guard.decide('gh pr merge', baseIs(null)).allow).toBe(false);
  });

  test.each(['gh pr merge 12 --admin', 'gh pr merge --admin --merge 12', 'gh pr merge --admin'])(
    '%s',
    (command) => {
      expect(guard.decide(command, baseIs('staging')).allow).toBe(false);
    },
  );

  test('a merge after another command', () => {
    expect(guard.decide('git status && gh pr merge 12', baseIs('main')).allow).toBe(false);
    expect(guard.decide('echo a; gh pr merge 12', baseIs('main')).allow).toBe(false);
  });
});

describe('the API merge', () => {
  test.each([
    'gh api -X PUT repos/example/repo/pulls/12/merge',
    'gh api --method PUT /repos/example/repo/pulls/12/merge -f merge_method=merge',
    'gh api repos/example/repo/pulls/12/merge -X PUT',
    'gh api "repos/example/repo/pulls/12/merge"',
  ])('%s', (command) => {
    expect(guard.decide(command, baseIs('staging')).allow).toBe(false);
  });

  test('another API call passes', () => {
    expect(guard.decide('gh api user --jq .login', baseIs(null)).allow).toBe(true);
    expect(guard.decide('gh api repos/example/repo/pulls/12', baseIs(null)).allow).toBe(true);
  });
});
