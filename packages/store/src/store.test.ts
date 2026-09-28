import { S3Client, type ServiceOutputTypes } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { RawStore } from './bucket.ts';
import { listKeys } from './listing.ts';
import { putObject } from './object.ts';

const LIST_REFUSED = 'the raw store did not list the bucket, and the corpus was not read';
const PUT_REFUSED = 'the raw store did not take the object, and nothing was written';

const bytes = new TextEncoder().encode('the bytes exactly as they arrived');
const MIME = 'application/pdf';

const asked = z.object({
  Key: z.string().optional(),
  ContinuationToken: z.string().optional(),
});

interface Sent {
  readonly command: string;
  readonly input: z.infer<typeof asked>;
}

type Answer = (sent: Sent) => ServiceOutputTypes | Error;

// Departure: the fake is a real client that answers in its first step. No request is signed or
// sent, so the test needs no store, no credential and no network.
const fakeStore = (answer: Answer): { store: RawStore; sent: Sent[] } => {
  const sent: Sent[] = [];
  const client = new S3Client({
    region: 'us-east-1',
    credentials: { accessKeyId: 'offline', secretAccessKey: 'offline' },
  });
  client.middlewareStack.add(
    (_next, context) => (args) => {
      const one = { command: context.commandName ?? '', input: asked.parse(args.input) };
      sent.push(one);
      const output = answer(one);
      return output instanceof Error
        ? Promise.reject(output)
        : Promise.resolve({ output, response: {} });
    },
    { step: 'initialize' },
  );
  return { store: { client, bucket: 'raw' }, sent };
};

const refusing = (fault: Error): RawStore => fakeStore(() => fault).store;

describe('listKeys', () => {
  it('reads every page, and asks for the second page with the token of the first', async () => {
    const { store, sent } = fakeStore(({ input }) =>
      input.ContinuationToken === undefined
        ? { $metadata: {}, Contents: [{ Key: 'a' }, { Key: 'b' }], NextContinuationToken: 'next' }
        : { $metadata: {}, Contents: [{ Key: 'c' }] },
    );

    await expect(listKeys(store)).resolves.toStrictEqual(['a', 'b', 'c']);
    expect(sent).toEqual([
      { command: 'ListObjectsV2Command', input: {} },
      { command: 'ListObjectsV2Command', input: { ContinuationToken: 'next' } },
    ]);
  });

  it('gives the fixed sentence when the store refuses, and keeps the fault as the cause', async () => {
    const fault = new Error('connect ECONNREFUSED 127.0.0.1:9000');

    await expect(listKeys(refusing(fault))).rejects.toThrow(
      expect.objectContaining({ message: LIST_REFUSED, cause: fault }),
    );
  });
});

describe('putObject', () => {
  it('gives the fixed sentence when the store refuses, and keeps the fault as the cause', async () => {
    const fault = new Error('connect ECONNREFUSED 127.0.0.1:9000');

    await expect(
      putObject(refusing(fault), { key: 'raw/doc.pdf', bytes, mime: MIME }),
    ).rejects.toThrow(expect.objectContaining({ message: PUT_REFUSED, cause: fault }));
  });

  it('writes a key with outer spaces trimmed, and the listing returns the trimmed key', async () => {
    const held: string[] = [];
    const { store, sent } = fakeStore(({ command, input }) => {
      if (command === 'PutObjectCommand' && input.Key !== undefined) held.push(input.Key);
      return { $metadata: {}, Contents: held.map((key) => ({ Key: key })) };
    });

    await expect(putObject(store, { key: ' raw/doc.pdf ', bytes, mime: MIME })).resolves.toBe(
      'raw/doc.pdf',
    );
    expect(sent[0]).toStrictEqual({ command: 'PutObjectCommand', input: { Key: 'raw/doc.pdf' } });
    await expect(listKeys(store)).resolves.toStrictEqual(['raw/doc.pdf']);
  });
});
