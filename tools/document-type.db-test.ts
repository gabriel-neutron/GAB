// A document has a type. The fetch door stores the type it gets, a call with no type stores
// `other`, the list of types is closed, and the operator fills the type of a stored document once.
// The read view publishes the type. Each gesture rolls back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const SHA = 'd'.repeat(64);
const ID = `doc_${SHA.slice(0, 12)}`;

const PUT =
  "SELECT public.put_fetched_document('url', 'An act', $1, 'https://example.org/act', $2, " +
  "'application/pdf', (clock_timestamp() AT TIME ZONE 'UTC')::date, NULL, NULL, $3) AS id";
const PUT_NO_TYPE =
  "SELECT public.put_fetched_document('url', 'An act', $1, 'https://example.org/act', $2, " +
  "'application/pdf', (clock_timestamp() AT TIME ZONE 'UTC')::date) AS id";

const types = z.array(z.object({ doc_type: z.string() }));

const typeOf = async (ask: Ask): Promise<string | undefined> =>
  types.parse(await ask('SELECT doc_type FROM api.document WHERE id = $1', [ID]))[0]?.doc_type;

test('the fetch door stores the type it gets, and the read view publishes it', async () => {
  const found = await rolledBack('research', async (ask) => {
    await ask(PUT, [`raw/${SHA}`, SHA, 'legal_act']);
    return typeOf(ask);
  });
  expect(found).toBe('legal_act');
});

test('a document stored with no type has the type other', async () => {
  const found = await rolledBack('research', async (ask) => {
    await ask(PUT_NO_TYPE, [`raw/${SHA}`, SHA]);
    return typeOf(ask);
  });
  expect(found).toBe('other');
});

test('a word outside the list of types is refused', async () => {
  await expect(
    rolledBack('research', async (ask) => {
      await ask(PUT, [`raw/${SHA}`, SHA, 'blog']);
    }),
  ).rejects.toMatchObject({ code: '23514' });
});

test('the fill of a document that does not exist changes nothing', async () => {
  const found = await rolledBack('app', async (ask) => {
    const first = await ask('SELECT public.fill_document_type($1, $2) AS changed', [
      'doc_000000000001',
      'report',
    ]);
    return first;
  });
  expect(found).toStrictEqual([{ changed: false }]);
});

test('the fill changes a document of type other, and then keeps its type', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    await ask(PUT_NO_TYPE, [`raw/${SHA}`, SHA]);
    const changed = await ask('SELECT public.fill_document_type($1, $2) AS changed', [
      ID,
      'press_release',
    ]);
    const again = await ask('SELECT public.fill_document_type($1, $2) AS changed', [ID, 'report']);
    return { changed, again, type: await typeOf(ask) };
  });
  expect(found).toStrictEqual({
    changed: [{ changed: true }],
    again: [{ changed: false }],
    type: 'press_release',
  });
});
