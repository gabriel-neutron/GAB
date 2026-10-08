import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, test, vi } from 'vitest';

import { referenceSetCommand } from './reference-set-command.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

const run = async (file: string): Promise<{ code: number; text: string }> => {
  const lines: string[] = [];
  vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
    lines.push(String(line));
  });
  const code = await referenceSetCommand(['load', file]);
  return { code, text: lines.join('\n') };
};

test('a load of a missing file prints a short message and fails', async () => {
  const { code, text } = await run(join(tmpdir(), 'no-such-reference-set.json'));

  expect(code).toBe(1);
  expect(text).toContain('Cannot read the file');
  expect(text).not.toContain(' at ');
});

test('a load of a file with bad JSON prints a short message and fails', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'reference-set-')), 'bad.json');
  writeFileSync(file, 'not json');

  const { code, text } = await run(file);

  expect(code).toBe(1);
  expect(text).toContain('not valid JSON');
  expect(text).not.toContain(' at ');
});
