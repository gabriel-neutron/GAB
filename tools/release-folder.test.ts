import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { REPORT_FILES } from '@gab/release/report-files';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { releaseAssets } from './release-folder.ts';

const FOLDER = join(import.meta.dirname, '../packages/site/fixtures/release');

const listed = z
  .object({
    files: z.array(z.object({ path: z.string(), sha256: z.string() })),
    changelog: z.object({ path: z.string() }),
  })
  .parse(JSON.parse(readFileSync(join(FOLDER, 'manifest.json'), 'utf8')));

test('the build copies every file of the release, byte for byte', () => {
  const copies = new Map(releaseAssets(FOLDER).map((one) => [one.fileName, one.source]));
  for (const file of listed.files) {
    const copy = copies.get(`release/${file.path}`);
    expect(copy).toBeDefined();
    expect(copy?.equals(readFileSync(join(FOLDER, file.path)))).toBe(true);
  }
  expect(copies.has('release/manifest.json')).toBe(true);
  // The downloads page links the changelog by the path that the manifest names.
  expect(copies.has(`release/${listed.changelog.path}`)).toBe(true);
});

test('the report folder copies the three data files and no other file', () => {
  const folder = mkdtempSync(join(tmpdir(), 'gab-report-'));
  for (const name of [...Object.values(REPORT_FILES), 'private-notes.txt'])
    writeFileSync(join(folder, name), 'x');
  const names = releaseAssets(folder, 'report', Object.values(REPORT_FILES)).map(
    (one) => one.fileName,
  );
  expect(names.sort()).toStrictEqual(
    Object.values(REPORT_FILES)
      .map((name) => `report/${name}`)
      .sort(),
  );
});
