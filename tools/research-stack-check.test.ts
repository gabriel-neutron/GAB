// The research session checks the database of the record before any research step. The test
// injects the TCP check and the start of the stack, so it opens no socket and calls no docker.

import { createRequire } from 'node:module';

import { expect, test, vi } from 'vitest';

type Verdict = 'answers' | 'started' | 'down';

const { check } = createRequire(import.meta.url)('../research/.claude/hooks/check_stack.cjs') as {
  check: (probe: () => Promise<boolean>, start: () => void) => Promise<Verdict>;
};

test('a database that answers is left alone', async () => {
  const start = vi.fn();

  expect(await check(() => Promise.resolve(true), start)).toBe('answers');
  expect(start).not.toHaveBeenCalled();
});

test('a database that does not answer gets one start, and then answers', async () => {
  const probe = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const start = vi.fn();

  expect(await check(probe, start)).toBe('started');
  expect(start).toHaveBeenCalledTimes(1);
});

test('a database that still does not answer after one start is down', async () => {
  const start = vi.fn();

  expect(await check(() => Promise.resolve(false), start)).toBe('down');
  expect(start).toHaveBeenCalledTimes(1);
});
