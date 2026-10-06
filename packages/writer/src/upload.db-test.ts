import { createHash, randomBytes } from 'node:crypto';

import { LARGEST_UPLOAD_BODY, UPLOAD_FILE_BYTES } from '@gab/proposal/upload-limit';
import { openStore, putObject } from '@gab/store';
import { listKeys } from '@gab/store/listing';
import { Pool } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { openPool } from './pool.ts';
import { writeRoutes } from './routes.ts';

const pool = openPool();
const store = openStore();
const app = writeRoutes(pool, { put: (object) => putObject(store, object) });

// Departure: the suite reads the private tables as the owner of the database, because no api
// view shows the text or the object key.
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
  await owner.query('DELETE FROM public.document_text WHERE document_id = ANY($1::text[])', [
    written,
  ]);
  await owner.query('DELETE FROM public.jobs WHERE document_id = ANY($1::text[])', [written]);
  await owner.query('DELETE FROM public.documents WHERE id = ANY($1::text[])', [written]);
  await owner.end();
  await pool.end();
  store.client.destroy();
});

const OWN = { host: '127.0.0.1:5177', 'content-type': 'application/json' };

const replyShape = z.object({
  state: z.string().optional(),
  documentId: z.string().optional(),
  emptyPages: z.array(z.number()).optional(),
  refusal: z.string().optional(),
});

const send = async (
  body: string,
  headers: Record<string, string> = OWN,
): Promise<[number, z.infer<typeof replyShape>]> => {
  const answer = await app.request('/write/upload-document', { method: 'POST', headers, body });
  return [answer.status, replyShape.parse(await answer.json())];
};

// One run never meets the bytes of an earlier run: an object stays in the bucket for ever.
const freshText = (): Buffer =>
  Buffer.from(`Form MGT-7, annual return, a test run ${randomBytes(8).toString('hex')}`);

const hashOf = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const requestOf = (bytes: Uint8Array, fields: Record<string, unknown> = {}): string =>
  JSON.stringify({
    fileName: 'mgt-7.txt',
    title: 'MGT-7 of a test company',
    content: Buffer.from(bytes).toString('base64'),
    retrievedAt: '2026-10-01',
    uri: 'https://www.mca.gov.in/purchase/4711',
    providerId: 'mca21',
    costEur: 12.5,
    ...fields,
  });

const rowsFor = async (sha256: string): Promise<number> =>
  Number(
    (
      await owner.query<{ n: string }>(
        'SELECT count(*) AS n FROM public.documents WHERE sha256 = $1',
        [sha256],
      )
    ).rows[0]?.n,
  );

const pagesFor = async (id: string): Promise<number> =>
  Number(
    (
      await owner.query<{ n: string }>(
        'SELECT count(*) AS n FROM public.document_text WHERE document_id = $1',
        [id],
      )
    ).rows[0]?.n,
  );

const inBucket = async (sha256: string): Promise<boolean> =>
  (await listKeys(store)).includes(`raw/${sha256}`);

/** Nothing of these bytes is in the record or in the bucket. */
const nothingStored = async (bytes: Uint8Array): Promise<Record<string, unknown>> => {
  const sha256 = hashOf(bytes);
  return {
    rows: await rowsFor(sha256),
    pages: await pagesFor(`doc_${sha256.slice(0, 12)}`),
    object: await inBucket(sha256),
  };
};

const NOTHING = { rows: 0, pages: 0, object: false };

test('an upload stores one document with its fields, its object and its text', async () => {
  const bytes = freshText();
  const sha256 = hashOf(bytes);
  const id = `doc_${sha256.slice(0, 12)}`;
  written.push(id);

  expect(await send(requestOf(bytes))).toStrictEqual([
    200,
    { state: 'stored', documentId: id, emptyPages: [] },
  ]);

  const row = await owner.query(
    `SELECT kind, title, uri, s3_key, sha256, mime, retrieved_at::text AS day, provider_id,
            cost_eur::text AS cost FROM public.documents WHERE id = $1`,
    [id],
  );
  expect(row.rows).toStrictEqual([
    {
      kind: 'file',
      title: 'MGT-7 of a test company',
      uri: 'https://www.mca.gov.in/purchase/4711',
      s3_key: `raw/${sha256}`,
      sha256,
      mime: 'text/plain',
      day: '2026-10-01',
      provider_id: 'mca21',
      cost: '12.50',
    },
  ]);

  const text = await owner.query(
    'SELECT page, text FROM public.document_text WHERE document_id = $1 ORDER BY page',
    [id],
  );
  expect(text.rows).toStrictEqual([{ page: 1, text: bytes.toString('utf8') }]);
  expect(await inBucket(sha256)).toBe(true);
});

test('the same bytes again answer the same id, and no second row is written', async () => {
  const bytes = freshText();
  const sha256 = hashOf(bytes);
  const id = `doc_${sha256.slice(0, 12)}`;
  written.push(id);

  const [first] = await send(requestOf(bytes));
  expect(first).toBe(200);
  expect(await send(requestOf(bytes, { title: 'Another title', fileName: 'again.txt' }))).toEqual([
    200,
    { state: 'known', documentId: id, emptyPages: [] },
  ]);
  expect(await rowsFor(sha256)).toBe(1);
});

test('an upload with no retrieval date is refused, and nothing is stored', async () => {
  const bytes = freshText();
  const [status, reply] = await send(requestOf(bytes, { retrievedAt: undefined }));
  expect(status).toBe(422);
  expect(reply.refusal).toMatch(/retrievedAt/);
  expect(await nothingStored(bytes)).toStrictEqual(NOTHING);
});

test('a body over the cap is refused, and nothing is stored', async () => {
  const bytes = freshText();
  const padded = requestOf(bytes, { title: 'x'.repeat(LARGEST_UPLOAD_BODY) });
  const [status] = await send(padded);
  expect(status).toBe(413);
  expect(await nothingStored(bytes)).toStrictEqual(NOTHING);
});

test('a file over the cap inside a body under it is refused, and nothing is stored', async () => {
  const bytes = randomBytes(UPLOAD_FILE_BYTES + 1);
  const body = requestOf(bytes);
  expect(body.length).toBeLessThanOrEqual(LARGEST_UPLOAD_BODY);
  const [status] = await send(body);
  expect(status).toBe(413);
  expect(await nothingStored(bytes)).toStrictEqual(NOTHING);
});

test('a provider the record does not hold is refused, and no row is written', async () => {
  const bytes = freshText();
  const [status, reply] = await send(requestOf(bytes, { providerId: 'no_such_provider' }));
  expect(status).toBe(422);
  expect(reply.refusal).toMatch(/provider/);
  expect(await rowsFor(hashOf(bytes))).toBe(0);
});

test('a file that cannot be read is refused, and nothing is stored', async () => {
  const bytes = Buffer.from(`%PDF-1.7 not a real document ${randomBytes(8).toString('hex')}`);
  const [status] = await send(requestOf(bytes, { fileName: 'broken.pdf' }));
  expect(status).toBe(422);
  expect(await nothingStored(bytes)).toStrictEqual(NOTHING);
});

test('a request from another origin or another host is refused, and nothing is stored', async () => {
  const bytes = freshText();
  const foreign = [
    { ...OWN, origin: 'https://attacker.example' },
    { ...OWN, host: 'attacker.example:5177' },
    { ...OWN, 'sec-fetch-site': 'cross-site' },
  ];
  for (const headers of foreign) expect((await send(requestOf(bytes), headers))[0]).toBe(403);
  expect(await nothingStored(bytes)).toStrictEqual(NOTHING);
});
