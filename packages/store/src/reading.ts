import { createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

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

/** Copy one object to a file as a stream, so a large object is never held in memory. */
export const downloadObject = async (store: RawStore, key: string, path: string): Promise<void> => {
  try {
    const found = await store.client.send(new GetObjectCommand({ Bucket: store.bucket, Key: key }));
    if (!(found.Body instanceof Readable)) throw new Error(NOT_GIVEN);
    await pipeline(found.Body, createWriteStream(path));
    // A connection that closes early ends the stream with no fault, so the size is checked.
    const { size } = await stat(path);
    if (found.ContentLength !== undefined && size !== found.ContentLength)
      throw new Error(`${NOT_GIVEN}: ${String(size)} of ${String(found.ContentLength)} bytes`);
  } catch (cause) {
    throw new Error(NOT_GIVEN, { cause });
  }
};
