import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterAll, beforeAll, expect, test } from 'vitest';

import { writeLargeWorkbook } from './archive-fixture.ts';
import { MAX_PART_BYTES, sheetCsv } from './xlsx.ts';
import { fileSource } from './zip.ts';

// A sheet that inflates to more than the cap of a part in memory. The reader streams it from a
// file. The table of shared strings is empty here, because the fixture writes inline strings.
const ROWS = 450_000;
const KEPT_EVERY = 100_000;
const rowOf = (index: number): string[] =>
  index === 0
    ? ['Id', 'Country', 'Name', 'Operator', 'Note']
    : [
        String(index),
        index % KEPT_EVERY === 0 ? 'Russia' : 'Elsewhere',
        `Site number ${String(index)} of the invented list`,
        `Operator of site ${String(index)} with a long invented name`,
        'a note that makes the row longer, to make the sheet large, and the whole read above its cap',
      ];

let folder = '';
let path = '';

beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'gab-large-sheet-'));
  path = join(folder, 'large.xlsx');
  await writeLargeWorkbook(path, 'Data', ROWS, rowOf);
}, 180_000);

afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

test('a sheet larger than the cap of a part is read as a stream, and only the kept rows stay', async () => {
  // A child process starts with its own peak RSS, which grows only with its own read.
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [join(import.meta.dirname, 'large-sheet-child.ts'), path],
    { maxBuffer: 1024 * 1024 },
  );
  const { growth, lines } = JSON.parse(stdout) as { growth: number; lines: number };

  expect(lines).toBe(4 + 1 + 1);
  expect(growth).toBeLessThan(96);
  // The sheet is larger than the cap that a part held in memory has.
  expect(ROWS * 300).toBeGreaterThan(MAX_PART_BYTES);
}, 180_000);

test('a whole-sheet read that keeps more than the cap is refused', async () => {
  const source = await fileSource(path);
  try {
    await expect(sheetCsv(source, 'Data')).rejects.toThrow(/keeps more than/u);
  } finally {
    await source.close();
  }
}, 180_000);
