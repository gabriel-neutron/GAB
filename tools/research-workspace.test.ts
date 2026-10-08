// The research workspace opens Claude Code and Codex on the GAB tools alone. Its sessions must not
// reach the secret of the build stack, so its files name one server and its own credentials only.
// The test reads text and opens no socket.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from 'vitest';
import { z } from 'zod';

const ROOT = path.resolve(import.meta.dirname, '..');

// The names an environment file sets. A comment line or a blank line sets nothing.
const namesSet = (text: string): Set<string> =>
  new Set(
    text
      .split(/\r?\n/u)
      .map((line) => /^\s*([A-Z_][A-Z0-9_]*)\s*=/u.exec(line)?.[1])
      .filter((name): name is string => name !== undefined),
  );

const read = (...parts: string[]): string => readFileSync(path.join(ROOT, ...parts), 'utf8');

const server = z.object({
  type: z.literal('stdio'),
  command: z.string(),
  args: z.array(z.string()),
});

const claudeFile = z.object({ mcpServers: z.record(z.string(), server) });

const SERVER_SCRIPT = path.join(ROOT, 'packages', 'mcp', 'src', 'main.ts');

test('the Claude Code file names the GAB server and no other', () => {
  const { mcpServers } = claudeFile.parse(JSON.parse(read('research', '.mcp.json')));

  expect(Object.keys(mcpServers)).toEqual(['gab']);
});

// A client starts the server in the folder of its file. The server reads research/.env by itself,
// so no file passes an environment file that the working folder would choose.
const gabServerOf = (folder: string): readonly string[] => {
  const { mcpServers } = claudeFile.parse(JSON.parse(read(folder, '.mcp.json')));
  const gab = mcpServers['gab'];
  if (gab === undefined) throw new Error(`${folder}/.mcp.json names no gab server`);
  expect(gab.command).toBe('node');
  return gab.args;
};

const codexArgsOf = (folder: string): readonly string[] => {
  const text = read(folder, '.codex', 'config.toml');
  expect(text).toMatch(/^\[mcp_servers\.gab\]$/mu);
  expect(text).toMatch(/^command = "node"$/mu);
  const args = /^args = (\[.*\])$/mu.exec(text)?.[1];
  if (args === undefined) throw new Error(`${folder}/.codex/config.toml gives no args`);
  return z.array(z.string()).parse(JSON.parse(args));
};

test.each([
  ['the Claude Code file of the workspace', 'research', gabServerOf],
  ['the Claude Code file of the root', '.', gabServerOf],
  ['the Codex file of the workspace', 'research', codexArgsOf],
  ['the Codex file of the root', '.', codexArgsOf],
] as const)('%s starts the one server and passes no environment file', (_, folder, argsOf) => {
  const args = argsOf(folder);
  expect(args).toHaveLength(1);
  // Claude Code gives the folder of the project in this variable, so the path does not follow the
  // folder where the session starts.
  const script = (args[0] ?? '').replace(/^\$\{CLAUDE_PROJECT_DIR:-\.\}\//u, '');
  expect(path.resolve(ROOT, folder, script)).toBe(SERVER_SCRIPT);
});

test('the research environment names its connection, the store, the two search settings, three register keys and the inbox, and nothing else', () => {
  expect(namesSet(read('research', '.env.example'))).toEqual(
    new Set([
      'GAB_RESEARCH_DATABASE_URL',
      'RAW_STORE_ACCESS_KEY',
      'RAW_STORE_SECRET_KEY',
      'RAW_STORE_ENDPOINT',
      'RAW_STORE_REGION',
      'SEARXNG_URL',
      'BRAVE_SEARCH_API_KEY',
      'COMPANIES_HOUSE_API_KEY',
      'OPENSANCTIONS_API_KEY',
      'GFW_API_TOKEN',
      'GAB_INBOX',
    ]),
  );
});

// The example is committed, so it holds no key. A key in it would be in git.
test('the research environment example names SearXNG and holds no key', () => {
  const value = (name: string): string | undefined =>
    new RegExp(`^${name}=(.*)$`, 'mu').exec(read('research', '.env.example'))?.[1]?.trim();

  expect(value('SEARXNG_URL')).toMatch(/^http:\/\//u);
  expect(value('BRAVE_SEARCH_API_KEY')).toBe('');
  expect(value('COMPANIES_HOUSE_API_KEY')).toBe('');
  expect(value('OPENSANCTIONS_API_KEY')).toBe('');
  expect(value('GFW_API_TOKEN')).toBe('');
});

// Departure: the example of the build stack is the list of its secrets. The real file is never
// read, because it holds the operator secret.
test('the research environment shares no name with the build stack except the store', () => {
  const research = namesSet(read('research', '.env.example'));
  const build = namesSet(read('infra', '.env.example'));

  const store = new Set([
    'RAW_STORE_ACCESS_KEY',
    'RAW_STORE_SECRET_KEY',
    'RAW_STORE_ENDPOINT',
    'RAW_STORE_REGION',
  ]);
  expect([...research].filter((name) => build.has(name) && !store.has(name))).toStrictEqual([]);
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

// Claude Code and Codex read the rules of the parent folder too. The first line of each research
// rules file says that it wins, so a research session never builds, commits or pushes.
test.each(['CLAUDE.md', 'AGENTS.md'])('the first line of %s overrides the build rules', (file) => {
  const [first] = read('research', file).split(/\r?\n/u);
  expect(first).toMatch(/override the build rules of the parent repository/u);
  expect(first).toMatch(/never commits/u);
});

// The example is committed, so it names no store. Empty values reach the local stack.
test('the research environment example leaves the address of the store empty', () => {
  const value = (name: string): string | undefined =>
    new RegExp(`^${name}=(.*)$`, 'mu').exec(read('research', '.env.example'))?.[1]?.trim();

  expect(value('RAW_STORE_ENDPOINT')).toBe('');
  expect(value('RAW_STORE_REGION')).toBe('');
});
