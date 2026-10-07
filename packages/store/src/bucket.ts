import { S3Client } from '@aws-sdk/client-s3';
import { z } from 'zod';

// External constraint: it holds the original file exactly as it arrived, and it is private. An
// open bucket re-publishes every source file, and a collected corpus holds files others own.
const BUCKET = 'raw';

// External constraint: a bucket named in the host name needs DNS that resolves it, and a loopback
// address resolves nothing. The path form puts the bucket in the URL, and every S3 store takes it.
const PATH_STYLE = true;

// Origin of the numbers: a write of bytes is slower than a query, so the deadline is longer than
// the one the database pool holds. A store that never answers must give the caller its thread.
const CONNECT_MS = 5_000;
const REQUEST_MS = 30_000;

// Origin of the numbers: the local stack serves its S3 API on 127.0.0.1:9000, and S3 signs each
// request over a region even where the store knows none. us-east-1 is the protocol default.
const absentWhenEmpty = (value: unknown): unknown => (value === '' ? undefined : value);
const placement = z.object({
  RAW_STORE_ENDPOINT: z.preprocess(absentWhenEmpty, z.url().default('http://127.0.0.1:9000')),
  RAW_STORE_REGION: z.preprocess(absentWhenEmpty, z.string().trim().min(1).default('us-east-1')),
});

// External constraint: the account may put an object in this bucket and list it, and nothing else.
// It may write over a key that exists, and the admin pair of the tests sits in the same process.
const secrets = z.object({
  RAW_STORE_ACCESS_KEY: z.string().trim().min(1),
  RAW_STORE_SECRET_KEY: z.string().trim().min(1),
});

// External constraint: the account may read an object in this bucket, and nothing else. Only the
// writer holds it, to show a stored image to the operator.
const readSecrets = z.object({
  RAW_STORE_READ_ACCESS_KEY: z.string().trim().min(1),
  RAW_STORE_READ_SECRET_KEY: z.string().trim().min(1),
});

const ABSENT =
  'the credential of the raw store is empty or absent. Set it in the environment file.';

const MISPLACED =
  'RAW_STORE_ENDPOINT is not an address, or RAW_STORE_REGION is blank. Correct it, or remove it.';

/** The address and the region of the store. The test account must reach the same store. */
export const storePlacement = (): { endpoint: string; region: string } => {
  const where = placement.safeParse(process.env);
  if (!where.success) throw new Error(MISPLACED);
  return { endpoint: where.data.RAW_STORE_ENDPOINT, region: where.data.RAW_STORE_REGION };
};

/** The store and the one bucket in it. Nothing above this holds the address or the account. */
export interface RawStore {
  readonly client: S3Client;
  readonly bucket: string;
}

const opened = (accessKeyId: string, secretAccessKey: string): RawStore => {
  const { endpoint, region } = storePlacement();
  const client = new S3Client({
    endpoint,
    region,
    forcePathStyle: PATH_STYLE,
    credentials: { accessKeyId, secretAccessKey },
    requestHandler: { connectionTimeout: CONNECT_MS, requestTimeout: REQUEST_MS },
  });
  return { client, bucket: BUCKET };
};

// Departure: nothing above the bucket knows which S3 store answers. The day the store changes,
// the environment or this file changes, and no caller does.
export const openStore = (): RawStore => {
  const held = secrets.safeParse(process.env);
  if (!held.success) throw new Error(ABSENT);
  return opened(held.data.RAW_STORE_ACCESS_KEY, held.data.RAW_STORE_SECRET_KEY);
};

/** The same bucket, opened with the account that may only read an object. */
export const openReadStore = (): RawStore => {
  const held = readSecrets.safeParse(process.env);
  if (!held.success) throw new Error(ABSENT);
  return opened(held.data.RAW_STORE_READ_ACCESS_KEY, held.data.RAW_STORE_READ_SECRET_KEY);
};
