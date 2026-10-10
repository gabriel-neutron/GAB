import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { csvFile } from './csv-file.ts';
import { PreviousReleaseFault, readPreviousRelease } from './previous-release.ts';

const SHIP = '00000000-0000-4000-8000-000000000001';

const FILES: Record<string, string> = {
  'entities.csv': csvFile('A preamble.', ['id', 'label'], [[SHIP, 'TEST TANKER']]),
  'relations.csv': csvFile('A preamble.', ['id', 'type'], []),
  'claims.csv': csvFile('A preamble.', ['claim_id', 'value'], [[`${SHIP}/imo`, '9123456']]),
  'merges.csv': csvFile(
    'A preamble.',
    ['act_id', 'action', 'absorbed_id', 'survivor_id', 'resolves_to'],
    [],
  ),
};

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** Writes a release folder with its file manifest, after the change, if any, to the folder. */
const folderWith = async (
  change?: (files: Record<string, string>, listed: Record<string, unknown>[]) => void,
): Promise<string> => {
  const folder = await mkdtemp(join(tmpdir(), 'gab-previous-release-'));
  const files = { ...FILES };
  const listed: Record<string, unknown>[] = Object.entries(files).map(([path, text]) => ({
    path,
    bytes: Buffer.byteLength(text),
    sha256: sha256(text),
  }));
  change?.(files, listed);
  for (const [path, text] of Object.entries(files)) await writeFile(join(folder, path), text);
  await writeFile(
    join(folder, 'manifest.json'),
    JSON.stringify({ dataset: 'GAB', version: '1.0', date: '2026-11-08', files: listed }),
  );
  return folder;
};

test('a sound release folder gives its version, its date and its tables', async () => {
  const previous = await readPreviousRelease(await folderWith());
  expect(previous.version).toBe('1.0');
  expect(previous.date).toBe('2026-11-08');
  expect(previous.tables['claims.csv']).toStrictEqual({
    header: ['claim_id', 'value'],
    rows: [[`${SHIP}/imo`, '9123456']],
  });
});

test.each([
  [
    'a file that does not agree with its checksum',
    (files: Record<string, string>) => {
      files['claims.csv'] = (files['claims.csv'] ?? '').replace('9123456', '9123457');
    },
    /claims\.csv.*checksum/u,
  ],
  [
    'a file that the manifest does not list',
    (_files: Record<string, string>, listed: Record<string, unknown>[]) => {
      listed.splice(
        listed.findIndex((one) => one['path'] === 'claims.csv'),
        1,
      );
    },
    /claims\.csv/u,
  ],
  [
    'a path out of the folder',
    (_files: Record<string, string>, listed: Record<string, unknown>[]) => {
      listed.push({ path: '../manifest.json', bytes: 1, sha256: sha256('x') });
    },
    /\.\.\/manifest\.json/u,
  ],
  [
    'a listed file that is not in the folder',
    (files: Record<string, string>) => {
      delete files['relations.csv'];
    },
    /relations\.csv cannot be read/u,
  ],
  [
    'a file with no identifier column',
    (files: Record<string, string>, listed: Record<string, unknown>[]) => {
      const text = csvFile('A preamble.', ['name'], [['x']]);
      files['entities.csv'] = text;
      const one = listed.find((file) => file['path'] === 'entities.csv');
      if (one !== undefined)
        Object.assign(one, { bytes: Buffer.byteLength(text), sha256: sha256(text) });
    },
    /entities\.csv.*id/u,
  ],
])('the previous release is refused for %s', async (_case, change, message) => {
  const folder = await folderWith(change);
  const read = readPreviousRelease(folder);
  await expect(read).rejects.toThrow(PreviousReleaseFault);
  await expect(read).rejects.toThrow(message);
});

test('a folder with no file manifest is refused', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'gab-previous-release-'));
  await expect(readPreviousRelease(folder)).rejects.toThrow(PreviousReleaseFault);
});

test('a release with no log of the merges reads as a release with no merge', async () => {
  const folder = await folderWith((files, listed) => {
    delete files['merges.csv'];
    listed.splice(
      listed.findIndex((one) => one['path'] === 'merges.csv'),
      1,
    );
  });
  expect((await readPreviousRelease(folder)).tables['merges.csv'].rows).toStrictEqual([]);
});

test('a manifest with a date that is not ISO 8601 is refused', async () => {
  const folder = await folderWith();
  await writeFile(
    join(folder, 'manifest.json'),
    JSON.stringify({ version: '1.0', date: '08/11/2026', files: [] }),
  );
  await expect(readPreviousRelease(folder)).rejects.toThrow(/not the manifest of a release/u);
});
