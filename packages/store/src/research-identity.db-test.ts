import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { storePlacement } from './bucket.ts';

const BUCKET = 'raw';
const { endpoint, region } = storePlacement();

// Departure: one key per run, so two runs never write over each other. Each object stays: the
// research account may not delete one, and a reset of the volume is what removes them.
const key = `test/research/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
const bytes = 'the page exactly as the research session fetched it';

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

const research = z.object({
  RAW_STORE_RESEARCH_ACCESS_KEY: z.string().trim().min(1),
  RAW_STORE_RESEARCH_SECRET_KEY: z.string().trim().min(1),
});

const admin = z.object({
  RAW_STORE_ADMIN_ACCESS_KEY: z.string().trim().min(1),
  RAW_STORE_ADMIN_SECRET_KEY: z.string().trim().min(1),
});

const clientOf = (accessKeyId: string, secretAccessKey: string): S3Client =>
  new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

// Departure: a stack with no research key would skip the one proof that the account cannot
// delete, so an absent key stops the file with the step that repairs it.
const asResearch = (): S3Client => {
  const held = research.safeParse(process.env);
  if (!held.success)
    throw new Error(
      'RAW_STORE_RESEARCH_ACCESS_KEY or RAW_STORE_RESEARCH_SECRET_KEY is empty or absent. Set ' +
        'both in infra/.env, then recreate the store service so it reads them.',
    );
  return clientOf(held.data.RAW_STORE_RESEARCH_ACCESS_KEY, held.data.RAW_STORE_RESEARCH_SECRET_KEY);
};

// External constraint: the account under test may write and may not read, so the account of the
// tests, which may read the bucket, checks the round trip on the same store.
const asAdmin = (): S3Client => {
  const held = admin.parse(process.env);
  return clientOf(held.RAW_STORE_ADMIN_ACCESS_KEY, held.RAW_STORE_ADMIN_SECRET_KEY);
};

const session = asResearch();
const reader = asAdmin();

afterAll(() => {
  session.destroy();
  reader.destroy();
});

test('the research account puts an object, and the same bytes come back', async () => {
  await session.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: bytes, ContentType: 'text/plain' }),
  );

  const found = await reader.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  expect(await found.Body?.transformToString()).toBe(bytes);
});

// Departure: the account policy grants one action, and only this test keeps every other action
// refused. A research session that may delete or read can erase or harvest the corpus.
test('the research account may not read, delete, list, or open the bucket', async () => {
  expect(GRANTS_NOTHING.Statement.map((statement) => statement.Effect)).not.toContain('Allow');

  await session.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: bytes }));

  await expect(
    session.send(new GetObjectCommand({ Bucket: BUCKET, Key: key })),
  ).rejects.toMatchObject(DENIED);

  await expect(
    session.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })),
  ).rejects.toMatchObject(DENIED);

  await expect(session.send(new ListObjectsV2Command({ Bucket: BUCKET }))).rejects.toMatchObject(
    DENIED,
  );

  await expect(
    session.send(
      new PutBucketPolicyCommand({ Bucket: BUCKET, Policy: JSON.stringify(GRANTS_NOTHING) }),
    ),
  ).rejects.toMatchObject(DENIED);

  const still = await reader.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  expect(await still.Body?.transformToString()).toBe(bytes);
});
