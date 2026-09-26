import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutBucketPolicyCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { openStore } from './bucket.ts';
import { listKeys } from './listing.ts';
import { putObject } from './object.ts';

const store = openStore();

// Departure: one key per run, so two runs never write over each other. Each object stays: this
// account may not delete one, and a reset of the volume is what removes them.
const key = `test/store/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
const bytes = new TextEncoder().encode('the bytes exactly as they arrived');
const MIME = 'text/plain';

const FORBIDDEN = 403;

const DENIED = { name: 'AccessDenied' };

// Departure: the refusal is proved with a policy that grants nothing. If the store accepts it by
// mistake, it opens no key, and its one Deny names a prefix that no writer uses.
const GRANTS_NOTHING = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Deny',
      Principal: '*',
      Action: ['s3:GetObject'],
      Resource: ['arn:aws:s3:::raw/test/store/no-writer-uses-this-prefix/*'],
    },
  ],
};

const root = z.object({
  MINIO_ROOT_USER: z.string().trim().min(1),
  MINIO_ROOT_PASSWORD: z.string().trim().min(1),
});

// External constraint: the account under test may write and may not read, so the account that
// administers the store checks the round trip.
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

// External constraint: the store answers an anonymous caller 403 before it looks for the key, so
// a 403 alone proves nothing. The credentialed read proves the key exists, and the pair of them
// says the object is there and is private.
test('the object exists, and it is not readable without a credential', async () => {
  const found = await reader.send(new GetObjectCommand({ Bucket: store.bucket, Key: key }));
  expect(found.ContentLength).toBe(bytes.length);

  const anonymous = await fetch(`http://127.0.0.1:9000/${store.bucket}/${key}`);
  expect(anonymous.status).toBe(FORBIDDEN);
});

// Departure: the account policy grants two actions, and only this test keeps every other action
// refused. Widen the policy by hand, and nothing else in this repository fails.
test('the account may not read, delete, or open the bucket', async () => {
  expect(GRANTS_NOTHING.Statement.map((statement) => statement.Effect)).not.toContain('Allow');

  await expect(
    store.client.send(new GetObjectCommand({ Bucket: store.bucket, Key: key })),
  ).rejects.toMatchObject(DENIED);

  await expect(
    store.client.send(new DeleteObjectCommand({ Bucket: store.bucket, Key: key })),
  ).rejects.toMatchObject(DENIED);

  await expect(
    store.client.send(
      new PutBucketPolicyCommand({ Bucket: store.bucket, Policy: JSON.stringify(GRANTS_NOTHING) }),
    ),
  ).rejects.toMatchObject(DENIED);
});

// Departure: the second action the account policy grants. The reconciliation reads every key, so
// a listing that is refused stops that door and no other test says so.
test('the account may list the bucket, and the key it wrote is in the listing', async () => {
  await putObject(store, { key, bytes, mime: MIME });

  await expect(listKeys(store)).resolves.toContain(key);
});
