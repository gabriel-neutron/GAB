// The server starts as a child process, so the test sees the exit code and the stream a client
// sees. The refused credentials point at a closed port, so no start reaches a database.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { expect, test } from 'vitest';

const MAIN = join(import.meta.dirname, 'main.ts');

const PASSWORD = 'never-print-this-secret';

const start = (url: string | undefined) => {
  const env: NodeJS.ProcessEnv = { PATH: process.env['PATH'] };
  if (url !== undefined) env['GAB_RESEARCH_DATABASE_URL'] = url;
  return spawnSync(process.execPath, [MAIN], { env, encoding: 'utf8', input: '', timeout: 20_000 });
};

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
  const run = start(undefined);
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
