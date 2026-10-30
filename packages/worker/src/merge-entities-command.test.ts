import { afterEach, expect, test, vi } from 'vitest';

import { mergeEntitiesCommand } from './merge-entities-command.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

const ONE = '11111111-1111-4111-8111-111111111111';
const TWO = '22222222-2222-4222-8222-222222222222';

const run = async (args: readonly string[]): Promise<{ code: number; text: string }> => {
  const lines: string[] = [];
  vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
    lines.push(String(line));
  });
  const code = await mergeEntitiesCommand(args);
  return { code, text: lines.join('\n') };
};

test.each([
  ['a flag that is not --keep-name', [ONE, TWO, '--keep-nam']],
  ['two flags', [ONE, TWO, '--keep-name', '--keep-name']],
  ['the flag before the entities', ['--keep-name', ONE, TWO]],
])('the command refuses %s with the usage text', async (_, args) => {
  const { code, text } = await run(args);

  expect(code).toBe(2);
  expect(text).toContain('--keep-name');
});
