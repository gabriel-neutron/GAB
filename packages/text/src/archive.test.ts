import { expect, test } from 'vitest';

import { ArchiveRefusal, archiveFiles, MAX_FOLDER_DEPTH, zipContainerType } from './archive.ts';
import { zipOf } from './xlsx-fixture.ts';

const textOf = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

test('each file of an archive comes out with its path and its bytes, with no folder or system file', async () => {
  const files = await archiveFiles(
    zipOf([
      ['entities.csv', 'id,name\nNK-1,Nayara\n'],
      ['data/', ''],
      ['data/notes.txt', 'A note.'],
      ['__MACOSX/data/._notes.txt', 'fork'],
      ['data/.DS_Store', 'hidden'],
    ]),
  );
  expect(files.map((file) => [file.path, textOf(file.bytes)])).toStrictEqual([
    ['entities.csv', 'id,name\nNK-1,Nayara\n'],
    ['data/notes.txt', 'A note.'],
  ]);
});

// The size of the second file, as the directory of the archive states it, made smaller than the
// bytes that the file inflates to.
const withStatedSize = (bytes: Uint8Array, size: number): Uint8Array => {
  const copy = Buffer.from(bytes);
  const directory = copy.readUInt32LE(copy.length - 22 + 16);
  const second = directory + 46 + copy.readUInt16LE(directory + 28);
  copy.writeUInt32LE(size, second + 24);
  return new Uint8Array(copy);
};

test.each([
  ['a path that climbs out of the archive', [['../evil.txt', 'x']], 'leaves the archive'],
  ['a path from the root of the disk', [['/etc/evil.txt', 'x']], 'root of a disk'],
  ['a path from a Windows drive', [['C:/evil.txt', 'x']], 'root of a disk'],
  ['a path with a backslash', [['data\\..\\evil.txt', 'x']], 'backslash'],
  [
    'a file too deep in folders',
    [[`${'a/'.repeat(MAX_FOLDER_DEPTH + 1)}deep.txt`, 'x']],
    'folders deep',
  ],
  ['an archive inside the archive, by its name', [['inner.zip', 'x']], 'inside the archive'],
  [
    'an archive inside the archive, by its bytes',
    [['inner.dat', 'PK\u0003\u0004 more']],
    'inside the archive',
  ],
  [
    'a zip bomb',
    [
      ['readme.txt', 'stored'],
      ['bomb.txt', 'a'.repeat(4 * 1024 * 1024)],
    ],
    'zip bomb',
  ],
] as const)('%s is refused', async (_name, entries, reason) => {
  const refused = archiveFiles(zipOf(entries));
  await expect(refused).rejects.toBeInstanceOf(ArchiveRefusal);
  await expect(refused).rejects.toThrow(reason);
});

test('a file that inflates past the size that the archive states is refused', async () => {
  const bytes = zipOf([
    ['readme.txt', 'stored'],
    ['data.csv', 'id,name\n'.repeat(100)],
  ]);
  await expect(archiveFiles(withStatedSize(bytes, 10))).rejects.toThrow(ArchiveRefusal);
});

test('bytes that are no zip archive are refused', async () => {
  await expect(archiveFiles(new TextEncoder().encode('no archive'))).rejects.toThrow(
    /no zip archive/u,
  );
});

test('a workbook in the archive is one file, and not an archive inside it', async () => {
  const workbook = zipOf([
    ['[Content_Types].xml', '<Types/>'],
    ['xl/workbook.xml', '<workbook/>'],
  ]);
  const files = await archiveFiles(zipOf([['data/table.xlsx', 'placeholder']]));
  expect(files.map((file) => file.path)).toStrictEqual(['data/table.xlsx']);
  expect(await zipContainerType(workbook)).toBe('workbook');
  expect(await zipContainerType(zipOf([['[Content_Types].xml', '<Types/>']]))).toBe('office');
  expect(await zipContainerType(zipOf([['entities.csv', 'id\n']]))).toBe('archive');
});

test('an encrypted file is refused with the reason', async () => {
  const bytes = Buffer.from(zipOf([['secret.txt', 'x']]));
  const directory = bytes.readUInt32LE(bytes.length - 22 + 16);
  bytes.writeUInt16LE(1, directory + 8);
  await expect(archiveFiles(new Uint8Array(bytes))).rejects.toThrow(/is encrypted/u);
});
