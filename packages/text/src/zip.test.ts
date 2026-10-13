import { expect, test } from 'vitest';

import { zipOf } from './xlsx-fixture.ts';
import { bytesSource, WorkbookFault, zipEntries } from './zip.ts';

const ARCHIVE = zipOf([
  ['a.txt', 'first part'],
  ['b.txt', 'second part'],
]);

const entriesOf = (bytes: Uint8Array) => zipEntries(bytesSource(bytes));

// A copy with one signature found and one number written after it.
const patched = (
  source: Uint8Array,
  signature: readonly number[],
  write: (view: DataView, at: number) => void,
): Uint8Array => {
  const copy = new Uint8Array(source);
  const at = Buffer.from(copy).lastIndexOf(Buffer.from(signature));
  expect(at).toBeGreaterThanOrEqual(0);
  write(new DataView(copy.buffer), at);
  return copy;
};

const DIRECTORY = [0x50, 0x4b, 0x01, 0x02];
const END = [0x50, 0x4b, 0x05, 0x06];
const LOCATOR = [0x50, 0x4b, 0x06, 0x07];

test('a good archive gives its parts', async () => {
  expect([...(await entriesOf(ARCHIVE)).keys()]).toStrictEqual(['a.txt', 'b.txt']);
});

test('a truncated archive is refused with a sentence', async () => {
  await expect(entriesOf(ARCHIVE.subarray(0, ARCHIVE.length - 30))).rejects.toThrow(WorkbookFault);
  await expect(entriesOf(new Uint8Array(3))).rejects.toThrow(WorkbookFault);
});

test('a Zip64 archive with no locator is refused', async () => {
  const zip64 = zipOf([['a.txt', 'x']], true);
  const broken = patched(zip64, LOCATOR, (view, at) => {
    view.setUint32(at, 0);
  });

  await expect(entriesOf(broken)).rejects.toThrow(/Zip64 locator/u);
});

test('a directory entry with a wrong signature is refused', async () => {
  const broken = patched(ARCHIVE, DIRECTORY, (view, at) => {
    view.setUint32(at, 0);
  });

  await expect(entriesOf(broken)).rejects.toThrow(/directory .* is broken/u);
});

test('a directory that lies past the end of the file is refused', async () => {
  const broken = patched(ARCHIVE, END, (view, at) => {
    view.setUint32(at + 16, 0x7fffff00, true);
  });

  await expect(entriesOf(broken)).rejects.toThrow(/past the end/u);
});

test('a part that starts past the end of the file is refused', async () => {
  const broken = patched(ARCHIVE, DIRECTORY, (view, at) => {
    view.setUint32(at + 42, 0x7fffff00, true);
  });

  await expect(entriesOf(broken)).rejects.toThrow(/past the end/u);
});

test('a name that passes the end of the directory is refused', async () => {
  const broken = patched(ARCHIVE, DIRECTORY, (view, at) => {
    view.setUint16(at + 28, 0xffff, true);
  });

  await expect(entriesOf(broken)).rejects.toThrow(WorkbookFault);
});

test('an archive that holds one name twice is refused', async () => {
  const twice = zipOf([
    ['a.txt', 'x'],
    ['a.txt', 'y'],
  ]);

  await expect(entriesOf(twice)).rejects.toThrow(/more than once/u);
});
