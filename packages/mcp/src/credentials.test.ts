// The server starts as a child process, so the test sees the exit code and the stream a client
// sees. The refused credentials point at a closed port, so no start reaches a database.

import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

import { expect, test } from 'vitest';

const MAIN = join(import.meta.dirname, 'main.ts');

const PASSWORD = 'never-print-this-secret';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');

// The variable is always set, so a research file of the checkout does not fill it.
const start = (url: string, cwd = ROOT) =>
  spawnSync(process.execPath, [MAIN], {
    cwd,
    env: { PATH: process.env['PATH'], GAB_RESEARCH_DATABASE_URL: url },
    encoding: 'utf8',
    input: '',
    timeout: 20_000,
  });

test('a start with the credentials of another role stops with a clear message', () => {
  const run = start(`postgresql://gabriel_app:${PASSWORD}@127.0.0.1:1/gabriel_test`);
  expect(run.status).toBe(1);
  expect(run.stderr).toContain(
    'the MCP server runs only as gabriel_research; the credentials name gabriel_app',
  );
  expect(run.stdout).toBe('');
  expect(run.stderr).not.toContain(PASSWORD);
  expect(run.stderr).not.toContain('127.0.0.1');
});

test('a start with no credentials stops with a clear message', () => {
  const run = start('');
  expect(run.status).toBe(1);
  expect(run.stderr).toContain('the MCP server runs only as gabriel_research');
  expect(run.stderr).toContain('GAB_RESEARCH_DATABASE_URL');
  expect(run.stdout).toBe('');
});

test('a start with credentials that are not a URL names no part of them', () => {
  const run = start(`gabriel_research ${PASSWORD}`);
  expect(run.status).toBe(1);
  expect(run.stderr).toContain('the MCP server runs only as gabriel_research');
  expect(run.stderr).not.toContain(PASSWORD);
});

test('a start that finds no database says to start the stack', () => {
  const run = start(`postgresql://gabriel_research:${PASSWORD}@127.0.0.1:1/gabriel_test`);
  expect(run.status).toBe(1);
  expect(run.stderr).toContain('(ECONNREFUSED): the database does not answer; start the stack');
  expect(run.stdout).toBe('');
  expect(run.stderr).not.toContain(PASSWORD);
  expect(run.stderr).not.toContain('127.0.0.1');
});

test.each(['.', 'research'])('the server starts the same from the folder %s', (folder) => {
  const run = start(
    `postgresql://gabriel_research:${PASSWORD}@127.0.0.1:1/gabriel_test`,
    join(ROOT, folder),
  );
  expect(run.status).toBe(1);
  expect(run.stderr).toContain('(ECONNREFUSED): the database does not answer; start the stack');
});
