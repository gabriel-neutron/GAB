import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, test, vi } from 'vitest';

import { releaseCommand } from './release-command.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

const run = async (args: readonly string[]): Promise<{ code: number; text: string }> => {
  const lines: string[] = [];
  vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
    lines.push(String(line));
  });
  const code = await releaseCommand(args);
  return { code, text: lines.join('\n') };
};

test('a manifest with no contact addresses is refused, and no folder is written', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'release-command-'));
  const manifest = join(folder, 'release.json');
  writeFileSync(manifest, JSON.stringify({ version: '1.0' }));
  const out = join(folder, 'out');

  const { code, text } = await run(['--manifest', manifest, '--out', out]);

  expect(code).toBe(2);
  expect(text).toContain('contacts');
  expect(readdirSync(folder)).toStrictEqual(['release.json']);
});

test.each([
  [[]],
  [['--manifest', 'a.json']],
  [['--out', 'x', '--manifest']],
  [['--x', 'a', '--out', 'b']],
  [['--manifest', 'a', '--out', 'b', '--previous', 'c', '--previous', 'd']],
  [['--manifest', 'a', '--out', 'b', '--previous', '']],
  [['--manifest', 'a', '--out', 'b', '--v1', '']],
  [['--manifest', 'a', '--out', 'b', '--v1', 'c', '--v1', 'd']],
])('the words %j give the usage', async (args) => {
  const { code, text } = await run(args);
  expect(code).toBe(2);
  expect(text).toContain('Usage: pnpm worker release');
});

test('a manifest that cannot be read gives a short message', async () => {
  const { code, text } = await run([
    '--manifest',
    join(tmpdir(), 'no-such-manifest.json'),
    '--out',
    'x',
  ]);
  expect(code).toBe(2);
  expect(text).toContain('Cannot read the release manifest');
});
