import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, expect, test } from 'vitest';

import { writeLargeWorkbook } from './archive-fixture.ts';
import { MAX_PART_BYTES, sheetCsv } from './xlsx.ts';
import { fileSource } from './zip.ts';

// A sheet that inflates to more than the cap of a part in memory. The reader streams it from a
// file, and the peak memory of the process stays far below the size of the sheet.
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
        'a note that makes the row longer, to make the sheet large',
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
  const source = await fileSource(path);
  try {
    // maxRSS counts kibibytes, and it never falls: the growth is the peak of the read.
    const before = process.resourceUsage().maxRSS;
    const text = await sheetCsv(source, 'Data', { column: 'Country', value: 'Russia' });
    const growth = (process.resourceUsage().maxRSS - before) / 1024;

    expect(text.split('\r\n')).toHaveLength(4 + 1 + 1);
    expect(text).toContain('Site number 100000 of the invented list');
    expect(growth).toBeLessThan(96);
    // The sheet is larger than the cap that a part held in memory has.
    expect(ROWS * 300).toBeGreaterThan(MAX_PART_BYTES);
  } finally {
    await source.close();
  }
}, 180_000);
