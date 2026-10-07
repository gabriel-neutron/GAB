import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { afterAll, expect, test } from 'vitest';

import { openReadStore, openStore } from './bucket.ts';
import { putObject } from './object.ts';
import { readObject } from './reading.ts';

// Departure: one key per run, so two runs never write over each other. Each object stays: no
// account of the application may delete one, and a reset of the volume is what removes them.
const key = `test/read/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

const DENIED = { name: 'AccessDenied' };

const writer = openStore();
const reader = openReadStore();

afterAll(() => {
  writer.client.destroy();
  reader.client.destroy();
});

test('the read account gives back the bytes that the application put', async () => {
  await putObject(writer, { key, bytes, mime: 'image/png' });

  await expect(readObject(reader, key)).resolves.toStrictEqual(bytes);
});

test('the read account says that a key with no object holds nothing', async () => {
  await expect(readObject(reader, `${key}.absent`)).rejects.toThrow(/did not give the object/u);
});

// Departure: the account policy grants one action, and only this test keeps every other action
// refused. A reader that may write, list or delete can change or harvest the corpus.
test('the read account may not put, list, or delete', async () => {
  await putObject(writer, { key, bytes, mime: 'image/png' });

  await expect(
    reader.client.send(new PutObjectCommand({ Bucket: reader.bucket, Key: key, Body: 'other' })),
  ).rejects.toMatchObject(DENIED);

  await expect(
    reader.client.send(new ListObjectsV2Command({ Bucket: reader.bucket })),
  ).rejects.toMatchObject(DENIED);

  await expect(
    reader.client.send(new DeleteObjectCommand({ Bucket: reader.bucket, Key: key })),
  ).rejects.toMatchObject(DENIED);

  await expect(readObject(reader, key)).resolves.toStrictEqual(bytes);
});
