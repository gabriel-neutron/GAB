import { PutObjectCommand } from '@aws-sdk/client-s3';

import type { RawStore } from './bucket.ts';

const EMPTY_KEY = 'an object is named by a key, and the key given is empty';
const REFUSED = 'the raw store did not take the object, and nothing was written';

/** One object to write: the bytes as they arrived, the key that names them, and their type. */
export interface RawObject {
  readonly key: string;
  readonly bytes: Uint8Array;
  readonly mime: string;
}

const named = (key: string): string => {
  const trimmed = key.trim();
  if (trimmed === '') throw new Error(EMPTY_KEY);
  return trimmed;
};

/** Write the object, and return the key that the `documents` row then records. */
// The object is written first and the row second. A row that names a key with no object is a
// dead reference no screen detects; an object with no row is invisible, and a sweep finds it.
export const putObject = async (store: RawStore, object: RawObject): Promise<string> => {
  const key = named(object.key);

  try {
    await store.client.send(
      new PutObjectCommand({
        Bucket: store.bucket,
        Key: key,
        Body: object.bytes,
        ContentType: object.mime,
      }),
    );
  } catch (cause) {
    // What the store raises names its address, and an address never reaches a screen. The
    // sentence is what a caller shows; the fault rides along, for the log and for a retry.
    throw new Error(REFUSED, { cause });
  }

  return key;
};
