import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { listedFiles, servedFiles } from './data-release.ts';

const folderWith = (files: Record<string, string>, listed: readonly string[]): string => {
  const folder = mkdtempSync(join(tmpdir(), 'gab-release-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(folder, name), text);
  const manifest = {
    files: listed.map((path) => ({
      path,
      sha256: createHash('sha256')
        .update(files[path] ?? '')
        .digest('hex'),
    })),
  };
  writeFileSync(join(folder, 'manifest.json'), JSON.stringify(manifest));
  return folder;
};

test('only the files of the manifest are served', () => {
  const folder = folderWith({ 'entities.csv': 'id\n', 'notes.txt': 'private' }, ['entities.csv']);
  expect(servedFiles(folder)).toEqual(['manifest.json', 'entities.csv']);
});

test('a folder with no manifest at its top is refused', () => {
  const folder = mkdtempSync(join(tmpdir(), 'gab-release-'));
  expect(() => listedFiles(folder)).toThrow(/no manifest.json/u);
});

test('a listed file with another checksum is refused', () => {
  const folder = folderWith({ 'entities.csv': 'id\n' }, ['entities.csv']);
  writeFileSync(join(folder, 'entities.csv'), 'changed\n');
  expect(() => listedFiles(folder)).toThrow(/does not match/u);
});
