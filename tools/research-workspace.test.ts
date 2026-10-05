// The research workspace opens Claude Code and Codex on the GAB tools alone. Its sessions must not
// reach the secret of the build stack, so its files name one server and its own credentials only.
// The test reads text and opens no socket.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from 'vitest';
import { z } from 'zod';

const ROOT = path.resolve(import.meta.dirname, '..');
const WORKSPACE = path.join(ROOT, 'research');

const read = (...parts: string[]): string => readFileSync(path.join(ROOT, ...parts), 'utf8');

const server = z.object({
  type: z.literal('stdio'),
  command: z.string(),
  args: z.array(z.string()),
});

const claudeFile = z.object({ mcpServers: z.record(z.string(), server) });

// The names an environment file sets. A comment line or a blank line sets nothing.
const namesSet = (text: string): Set<string> =>
  new Set(
    text
      .split(/\r?\n/u)
      .map((line) => /^\s*([A-Z_][A-Z0-9_]*)\s*=/u.exec(line)?.[1])
      .filter((name): name is string => name !== undefined),
  );

const SERVER_SCRIPT = path.join(ROOT, 'packages', 'mcp', 'src', 'main.ts');

test('the Claude Code file names the GAB server and no other', () => {
  const { mcpServers } = claudeFile.parse(JSON.parse(read('research', '.mcp.json')));

  expect(Object.keys(mcpServers)).toEqual(['gab']);
  const gab = mcpServers['gab'];
  expect(gab?.command).toBe('node');
  const script = gab?.args.find((arg) => arg.endsWith('.ts'));
  expect(script && path.resolve(WORKSPACE, script)).toBe(SERVER_SCRIPT);
});

test('the research environment names its own connection and one store key, and nothing else', () => {
  expect(namesSet(read('research', '.env.example'))).toEqual(
    new Set(['GAB_RESEARCH_DATABASE_URL', 'RAW_STORE_ACCESS_KEY', 'RAW_STORE_SECRET_KEY']),
  );
});

// Departure: the example of the build stack is the list of its secrets. The real file is never
// read, because it holds the operator secret.
test('the research environment shares no name with the build stack except the store key', () => {
  const research = namesSet(read('research', '.env.example'));
  const build = namesSet(read('infra', '.env.example'));

  expect(new Set([...research].filter((name) => build.has(name)))).toEqual(
    new Set(['RAW_STORE_ACCESS_KEY', 'RAW_STORE_SECRET_KEY']),
  );
});

test('git ignores the research environment file and keeps its example', () => {
  // External constraint: git answers 0 for an ignored path and 1 for a kept one. Any other code is
  // a fault of git, and it must not read as "kept".
  const ignored = (file: string): boolean => {
    const run = spawnSync('git', ['check-ignore', '--quiet', file], { cwd: ROOT });
    if (run.status !== 0 && run.status !== 1) throw new Error(`git check-ignore failed on ${file}`);
    return run.status === 0;
  };

  expect(ignored('research/.env')).toBe(true);
  expect(ignored('research/.env.example')).toBe(false);
});
