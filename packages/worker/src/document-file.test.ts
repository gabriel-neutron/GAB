import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, expect, test } from 'vitest';

import { writeDocumentFile } from './document-file.ts';

// A fixture document: bytes that are not valid UTF-8, so any conversion would change them.
const BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x00, 0x0d, 0x0a]);
const SHA = createHash('sha256').update(BYTES).digest('hex');

const folder = await mkdtemp(join(tmpdir(), 'gab-document-file-'));
afterAll(() => rm(folder, { recursive: true, force: true }));

const depsOf = (rows: unknown[]) => ({
  db: { query: () => Promise.resolve({ rows }) },
  read: () => Promise.resolve(BYTES),
});

test('it writes the stored bytes as they are, and gives their hash', async () => {
  const out = join(folder, 'a.bin');
  expect(await writeDocumentFile(depsOf([{ sha256: SHA, s3_key: 'raw/x' }]), '1', out)).toBe(SHA);
  expect(new Uint8Array(await readFile(out))).toStrictEqual(BYTES);
});

test('it refuses a file that exists, and keeps it', async () => {
  const out = join(folder, 'b.bin');
  await writeFile(out, 'old');
  await expect(
    writeDocumentFile(depsOf([{ sha256: SHA, s3_key: 'raw/x' }]), '1', out),
  ).rejects.toThrow();
  expect(await readFile(out, 'utf8')).toBe('old');
});

test('it writes no file when the bytes do not match the stored hash', async () => {
  const out = join(folder, 'c.bin');
  await expect(
    writeDocumentFile(depsOf([{ sha256: '0'.repeat(64), s3_key: 'raw/x' }]), '1', out),
  ).rejects.toThrow('do not match');
  await expect(readFile(out)).rejects.toThrow();
});

test('it refuses a document that is absent or has no stored file', async () => {
  const out = join(folder, 'd.bin');
  await expect(writeDocumentFile(depsOf([]), '1', out)).rejects.toThrow('not stored');
  await expect(
    writeDocumentFile(depsOf([{ sha256: SHA, s3_key: null }]), '1', out),
  ).rejects.toThrow('no stored file');
});
