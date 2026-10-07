import { GetObjectCommand } from '@aws-sdk/client-s3';

import type { RawStore } from './bucket.ts';

const NOT_GIVEN = 'the raw store did not give the object';

/** Read the bytes of one object exactly as they were stored. */
export const readObject = async (
  store: RawStore,
  key: string,
): Promise<Uint8Array<ArrayBuffer>> => {
  try {
    const found = await store.client.send(new GetObjectCommand({ Bucket: store.bucket, Key: key }));
    const bytes = await found.Body?.transformToByteArray();
    if (bytes === undefined) throw new Error(NOT_GIVEN);
    // External constraint: a web response takes bytes over a plain buffer, and the SDK types its
    // bytes over any buffer. The copy gives the plain buffer.
    return new Uint8Array(bytes);
  } catch (cause) {
    // What the store raises names its address, and an address never reaches a screen.
    throw new Error(NOT_GIVEN, { cause });
  }
};
