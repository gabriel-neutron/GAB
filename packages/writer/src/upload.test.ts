import { UPLOAD_FILE_BYTES } from '@gab/proposal/upload-limit';
import { DatabaseError } from 'pg';
import { expect, test } from 'vitest';

import type { Session } from './pool.ts';
import { parseUpload, uploadDocument } from './upload.ts';

const CONTENT = Buffer.from('the filing as it was bought').toString('base64');

const WHOLE = {
  fileName: 'mgt-7.pdf',
  title: 'MGT-7 of a company, 2025',
  content: CONTENT,
  retrievedAt: '2026-10-01',
  uri: 'https://www.mca.gov.in/purchase/4711',
  providerId: 'mca21',
  costEur: 12.5,
};

const parsed = (body: unknown) => parseUpload(JSON.stringify(body));

const refusalOf = (body: unknown): { status: number; refusal: RegExp | string } => {
  const held = parsed(body);
  if (held.ok) throw new Error('the parser took a body it must refuse');
  return { status: held.status, refusal: held.refusal };
};

test('a whole request is read into the bytes and the fields', () => {
  const held = parsed(WHOLE);
  expect(held).toStrictEqual({
    ok: true,
    upload: {
      bytes: new Uint8Array(Buffer.from('the filing as it was bought')),
      fileName: 'mgt-7.pdf',
      title: 'MGT-7 of a company, 2025',
      retrievedAt: '2026-10-01',
      uri: 'https://www.mca.gov.in/purchase/4711',
      providerId: 'mca21',
      costEur: '12.50',
    },
  });
});

test('the address, the provider and the cost may be absent', () => {
  const held = parsed({ ...WHOLE, uri: undefined, providerId: undefined, costEur: undefined });
  expect(held.ok && held.upload).toMatchObject({ uri: null, providerId: null, costEur: null });
});

test('a request with no retrieval date is refused', () => {
  expect(refusalOf({ ...WHOLE, retrievedAt: undefined })).toMatchObject({ status: 422 });
  expect(refusalOf({ ...WHOLE, retrievedAt: '' }).status).toBe(422);
});

test('a date that is not a real day is refused', () => {
  for (const day of ['2026-02-30', '2026-13-01', 'yesterday', '2026-9-1'])
    expect(refusalOf({ ...WHOLE, retrievedAt: day }).status).toBe(422);
});

test('a blank title or a blank file name is refused', () => {
  expect(refusalOf({ ...WHOLE, title: '   ' }).status).toBe(422);
  expect(refusalOf({ ...WHOLE, fileName: '' }).status).toBe(422);
});

test('an address that is not http or https is refused', () => {
  for (const uri of ['ftp://example.org/a.pdf', 'file:///etc/passwd', 'javascript:alert(1)', 'x'])
    expect(refusalOf({ ...WHOLE, uri }).status).toBe(422);
  expect(parsed({ ...WHOLE, uri: 'http://example.org/a' }).ok).toBe(true);
});

test('a negative cost, or a cost finer than a cent, is refused', () => {
  expect(refusalOf({ ...WHOLE, costEur: -1 }).status).toBe(422);
  expect(refusalOf({ ...WHOLE, costEur: 1.005 }).status).toBe(422);
  expect(refusalOf({ ...WHOLE, costEur: '12.50' }).status).toBe(422);
  const free = parsed({ ...WHOLE, costEur: 0 });
  expect(free.ok && free.upload.costEur).toBe('0.00');
});

test('a blank provider is refused, and the kind is not the caller to state', () => {
  expect(refusalOf({ ...WHOLE, providerId: ' ' }).status).toBe(422);
  expect(refusalOf({ ...WHOLE, kind: 'report' }).status).toBe(422);
});

test('content that is not base64, or that holds no byte, is refused', () => {
  expect(refusalOf({ ...WHOLE, content: 'not base64 at all!' }).status).toBe(422);
  expect(refusalOf({ ...WHOLE, content: '' }).status).toBe(422);
});

test('a body that is not JSON is refused', () => {
  const held = parseUpload('{"fileName":');
  expect(held.ok ? 0 : held.status).toBe(422);
});

test('a file over the cap is refused as too large', () => {
  const content = Buffer.alloc(UPLOAD_FILE_BYTES + 1).toString('base64');
  expect(refusalOf({ ...WHOLE, content }).status).toBe(413);
  const atCap = Buffer.alloc(UPLOAD_FILE_BYTES).toString('base64');
  expect(parsed({ ...WHOLE, content: atCap }).ok).toBe(true);
});

test('the second of two uploads of the same bytes at one instant answers the first row', async () => {
  const winner = 'doc_written_first';
  let looked = 0;
  const session: Session = {
    query: (text) => {
      if (text.includes('WHERE sha256')) {
        looked += 1;
        return Promise.resolve({ rows: looked === 1 ? [] : [{ id: winner }] });
      }
      if (text.includes('put_document(')) {
        const raised = new DatabaseError('duplicate key value', 19, 'error');
        raised.code = '23505';
        raised.constraint = 'documents_pkey';
        return Promise.reject(raised);
      }
      return Promise.resolve({ rows: [] });
    },
    release: () => undefined,
  };
  const act = await uploadDocument(
    { connect: () => Promise.resolve(session) },
    { put: (object) => Promise.resolve(object.key) },
    JSON.stringify({ ...WHOLE, fileName: 'mgt-7.txt' }),
  );
  expect(act).toStrictEqual({
    status: 200,
    reply: { state: 'known', documentId: winner, emptyPages: [] },
  });
});
