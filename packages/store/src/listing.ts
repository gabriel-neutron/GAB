import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { z } from 'zod';

import type { RawStore } from './bucket.ts';

const REFUSED = 'the raw store did not list the bucket, and the corpus was not read';

// The protocol answers a listing in pages and names the next one in a token. An answer with no
// token is the last page, and a caller that reads one page reads a truncated corpus.
const page = z.object({
  Contents: z.array(z.object({ Key: z.string().min(1) })).optional(),
  NextContinuationToken: z.string().min(1).optional(),
});

/** Every key the bucket holds, over every page. */
export const listKeys = async (store: RawStore): Promise<readonly string[]> => {
  const keys: string[] = [];
  let next: string | undefined = undefined;

  try {
    do {
      const found: z.infer<typeof page> = page.parse(
        await store.client.send(
          new ListObjectsV2Command({ Bucket: store.bucket, ContinuationToken: next }),
        ),
      );
      for (const held of found.Contents ?? []) keys.push(held.Key);
      next = found.NextContinuationToken;
    } while (next !== undefined);
  } catch (cause) {
    // What the store raises names its address, and an address never reaches a screen.
    throw new Error(REFUSED, { cause });
  }

  return keys;
};
