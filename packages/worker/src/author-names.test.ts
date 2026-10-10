import { afterEach, expect, test, vi } from 'vitest';

import { authorNamesCommand } from './author-names-command.ts';
import { dryRunLines, waitingLines } from './author-names.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

const ROW = { name_key: 'reuters wire', author: 'reuters', letter: 'B', units: 12 };

test('a name that waits reads with its author, its letter and its units', () => {
  expect(waitingLines([ROW])).toStrictEqual([
    'reuters wire  ->  reuters (B)  12 units',
    '1 names wait for a decision.',
  ]);
});

test('the dry-run gives the changes of each decision and says that it wrote nothing', () => {
  expect(dryRunLines([{ ...ROW, change_if_confirmed: 3, change_if_refused: 12 }])).toStrictEqual([
    'reuters wire  ->  reuters (B)  12 units: confirm changes 3, refuse changes 12',
    '1 names wait for a decision. The dry-run wrote nothing.',
  ]);
});

test('a name whose rating runs gives no count', () => {
  expect(dryRunLines([{ ...ROW, change_if_confirmed: null, change_if_refused: null }])[0]).toBe(
    'reuters wire  ->  reuters (B)  12 units: its rating runs now, so the dry-run gives no count',
  );
});

test.each([[[]], [['confirm']], [['refuse', ' ']], [['list', 'x']], [['undo', 'x']]])(
  'the words %j give the usage and open no connection',
  async (words) => {
    const said: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
      said.push(String(line));
    });
    expect(await authorNamesCommand(words)).toBe(2);
    expect(said.join('\n')).toContain('Usage: pnpm worker author-names');
  },
);
