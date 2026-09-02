import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { afterAll, expect, test } from 'vitest';

import { openStore } from './bucket.ts';
import { putObject } from './object.ts';

const store = openStore();

// One key per run, so two runs never write the same object and never delete each other's.
const key = `test/store/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
const bytes = new TextEncoder().encode('the bytes exactly as they arrived');
const MIME = 'text/plain';

const FORBIDDEN = 403;

afterAll(async () => {
  await store.client.send(new DeleteObjectCommand({ Bucket: store.bucket, Key: key }));
  store.client.destroy();
});

test('the object is written, and the key that comes back is the key to record', async () => {
  await expect(putObject(store, { key, bytes, mime: MIME })).resolves.toBe(key);
});

test('the bytes and the type come back exactly as they went in', async () => {
  await putObject(store, { key, bytes, mime: MIME });

  const found = await store.client.send(new GetObjectCommand({ Bucket: store.bucket, Key: key }));

  expect(found.ContentType).toBe(MIME);
  expect(await found.Body?.transformToString()).toBe(new TextDecoder().decode(bytes));
});

test('an empty key writes nothing', async () => {
  await expect(putObject(store, { key: '  ', bytes, mime: MIME })).rejects.toThrow(
    /key given is empty/u,
  );
});

// The bucket is private, and the object just written proves it on the wire and not in a
// configuration file. An open bucket re-publishes every source file this store holds.
test('the object is not readable without a credential', async () => {
  const answer = await fetch(`http://127.0.0.1:9000/${store.bucket}/${key}`);
  expect(answer.status).toBe(FORBIDDEN);
});
