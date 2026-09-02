import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutBucketPolicyCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { openStore } from './bucket.ts';
import { putObject } from './object.ts';

const store = openStore();

// One key per run, so two runs never write over each other. Each object stays: this account may
// not delete one, and a reset of the volume is what removes them.
const key = `test/store/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
const bytes = new TextEncoder().encode('the bytes exactly as they arrived');
const MIME = 'text/plain';

const FORBIDDEN = 403;

const DENIED = { name: 'AccessDenied' };

const OPEN_TO_ALL = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    { Effect: 'Allow', Principal: '*', Action: ['s3:GetObject'], Resource: ['arn:aws:s3:::raw/*'] },
  ],
});

const root = z.object({
  MINIO_ROOT_USER: z.string().trim().min(1),
  MINIO_ROOT_PASSWORD: z.string().trim().min(1),
});

// The account under test may write and may not read, so the round trip is checked by the account
// that administers the store. Reading back is not a thing the ingestion door is allowed to do.
const asRoot = (): S3Client => {
  const held = root.parse(process.env);
  return new S3Client({
    endpoint: 'http://127.0.0.1:9000',
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: held.MINIO_ROOT_USER,
      secretAccessKey: held.MINIO_ROOT_PASSWORD,
    },
  });
};

const reader = asRoot();

afterAll(() => {
  store.client.destroy();
  reader.destroy();
});

test('the object is written, and the key that comes back is the key to record', async () => {
  await expect(putObject(store, { key, bytes, mime: MIME })).resolves.toBe(key);
});

test('the bytes and the type come back exactly as they went in', async () => {
  await putObject(store, { key, bytes, mime: MIME });

  const found = await reader.send(new GetObjectCommand({ Bucket: store.bucket, Key: key }));

  expect(found.ContentType).toBe(MIME);
  expect(await found.Body?.transformToString()).toBe(new TextDecoder().decode(bytes));
});

test('an empty key writes nothing', async () => {
  await expect(putObject(store, { key: '  ', bytes, mime: MIME })).rejects.toThrow(
    /key given is empty/u,
  );
});

// The store answers an anonymous caller 403 before it looks for the key, so a 403 alone proves
// nothing about this object. The credentialed read above is what proves the key exists, and the
// pair of them is what says the object is there and is private.
test('the object exists, and it is not readable without a credential', async () => {
  const found = await reader.send(new GetObjectCommand({ Bucket: store.bucket, Key: key }));
  expect(found.ContentLength).toBe(bytes.length);

  const anonymous = await fetch(`http://127.0.0.1:9000/${store.bucket}/${key}`);
  expect(anonymous.status).toBe(FORBIDDEN);
});

// The policy grants one action, and this test is what keeps every other action refused. Widen
// the policy by hand, and nothing else in this repository fails.
test('the account may not read, delete, list, or open the bucket', async () => {
  await expect(
    store.client.send(new GetObjectCommand({ Bucket: store.bucket, Key: key })),
  ).rejects.toMatchObject(DENIED);

  await expect(
    store.client.send(new DeleteObjectCommand({ Bucket: store.bucket, Key: key })),
  ).rejects.toMatchObject(DENIED);

  await expect(
    store.client.send(new ListObjectsV2Command({ Bucket: store.bucket })),
  ).rejects.toMatchObject(DENIED);

  await expect(
    store.client.send(new PutBucketPolicyCommand({ Bucket: store.bucket, Policy: OPEN_TO_ALL })),
  ).rejects.toMatchObject(DENIED);
});
