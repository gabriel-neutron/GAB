import { S3Client } from '@aws-sdk/client-s3';
import { z } from 'zod';

// The S3 API of the local stack. The console runs on the next port, it is a different service,
// and this client never reaches it.
const ENDPOINT = 'http://127.0.0.1:9000';

// It holds the original file exactly as it arrived, and it is private: an open bucket
// re-publishes every source file, and a collected corpus holds files somebody else owns.
const BUCKET = 'raw';

// S3 signs every request over a region, so a value is required even where the store keeps one
// bucket and knows no region. This is the region the protocol defaults to.
const REGION = 'us-east-1';

// A bucket named in the host name needs DNS that resolves it, and a loopback address resolves
// nothing. The path form puts the bucket in the URL, and it is answered by every S3 store.
const PATH_STYLE = true;

// A write of bytes is slower than a query, and the deadline is longer than the one the database
// pool holds. A store that never answers must still give the caller back its thread.
const CONNECT_MS = 5_000;
const REQUEST_MS = 30_000;

// The account of the application. It may put an object in this bucket, and nothing else: it may
// not delete one, list the bucket, or make the bucket public. It may write over a key that
// exists, and the root pair sits in the same process, so neither of those is stopped here.
const secrets = z.object({
  RAW_STORE_ACCESS_KEY: z.string().trim().min(1),
  RAW_STORE_SECRET_KEY: z.string().trim().min(1),
});

const ABSENT =
  'the credential of the raw store is empty or absent. Set it in the environment file.';

/** The store and the one bucket in it. Nothing above this holds the address or the account. */
export interface RawStore {
  readonly client: S3Client;
  readonly bucket: string;
}

// Nothing above the bucket knows which S3 store answers. Every value here is protocol, so the
// day the store changes, this file changes and no caller does.
export const openStore = (): RawStore => {
  const held = secrets.safeParse(process.env);
  if (!held.success) throw new Error(ABSENT);

  const client = new S3Client({
    endpoint: ENDPOINT,
    region: REGION,
    forcePathStyle: PATH_STYLE,
    credentials: {
      accessKeyId: held.data.RAW_STORE_ACCESS_KEY,
      secretAccessKey: held.data.RAW_STORE_SECRET_KEY,
    },
    requestHandler: { connectionTimeout: CONNECT_MS, requestTimeout: REQUEST_MS },
  });

  return { client, bucket: BUCKET };
};
