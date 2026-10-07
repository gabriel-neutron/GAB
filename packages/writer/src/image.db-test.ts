import { createHash, randomBytes } from 'node:crypto';

import { openReadStore, openStore, putObject, readObject } from '@gab/store';
import { Pool } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { openPool } from './pool.ts';
import { writeRoutes } from './routes.ts';

const pool = openPool();
const store = openStore();
const reader = openReadStore();
const app = writeRoutes(
  pool,
  { put: (object) => putObject(store, object) },
  { read: (key) => readObject(reader, key) },
);

// Departure: the suite writes the document rows as the owner of the database, because the image
// that this door shows enters through another door, and no writer door writes a bare row.
const secrets = z.object({
  POSTGRES_PASSWORD: z.string().min(1),
  GABRIEL_DATABASE: z.literal('gabriel_test'),
});
const held = secrets.parse(process.env);
const owner = new Pool({
  connectionString: `postgresql://gabriel:${encodeURIComponent(held.POSTGRES_PASSWORD)}@127.0.0.1:5432/${held.GABRIEL_DATABASE}`,
});

const written: string[] = [];

afterAll(async () => {
  await owner.query('DELETE FROM public.documents WHERE id = ANY($1::text[])', [written]);
  await owner.end();
  await pool.end();
  store.client.destroy();
  reader.client.destroy();
});

// One run never meets the bytes of an earlier run: an object stays in the bucket for ever.
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const freshBytes = (head: readonly number[]): Uint8Array =>
  new Uint8Array([...head, ...randomBytes(16)]);

const storedDocument = async (bytes: Uint8Array, mime: string): Promise<string> => {
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const id = `doc_${sha256.slice(0, 12)}`;
  const key = await putObject(store, { key: `raw/${sha256}`, bytes, mime });
  await owner.query(
    `INSERT INTO public.documents (id, kind, title, s3_key, sha256, mime, retrieved_at)
     VALUES ($1, 'file', 'A unit tree of a test run', $2, $3, $4, DATE '2026-10-01')`,
    [id, key, sha256, mime],
  );
  written.push(id);
  return id;
};

const askImage = (body: unknown, origin?: string) =>
  app.request('/private/document-image', {
    method: 'POST',
    headers: {
      host: '127.0.0.1:5177',
      'content-type': 'application/json',
      ...(origin === undefined ? {} : { origin }),
    },
    body: JSON.stringify(body),
  });

const refusal = z.object({ refusal: z.string() });

test('a stored png image gives its bytes and its type', async () => {
  const bytes = freshBytes(PNG_HEAD);
  const document = await storedDocument(bytes, 'image/png');

  const answer = await askImage({ document });

  expect(answer.status).toBe(200);
  expect(answer.headers.get('content-type')).toBe('image/png');
  expect(new Uint8Array(await answer.arrayBuffer())).toStrictEqual(bytes);
});

test('a stored jpeg image gives its type', async () => {
  const document = await storedDocument(freshBytes([0xff, 0xd8, 0xff]), 'image/jpeg');

  const answer = await askImage({ document });

  expect(answer.status).toBe(200);
  expect(answer.headers.get('content-type')).toBe('image/jpeg');
});

test('a text document gives no bytes', async () => {
  const document = await storedDocument(
    new TextEncoder().encode(`Form MGT-7 of a test run ${randomBytes(8).toString('hex')}`),
    'text/plain',
  );

  const answer = await askImage({ document });

  expect(answer.status).toBe(422);
  expect(refusal.parse(await answer.json()).refusal).toBe(
    'the document is not a png or a jpeg image',
  );
});

test('a document that the record does not hold gives no bytes', async () => {
  const answer = await askImage({ document: 'doc_000000000000' });

  expect(answer.status).toBe(422);
  expect(refusal.parse(await answer.json()).refusal).toBe(
    'the record holds no document of that id',
  );
});

test('the image door refuses a request from another site', async () => {
  const answer = await askImage({ document: 'doc_000000000000' }, 'https://elsewhere.example');
  expect(answer.status).toBe(403);
});
