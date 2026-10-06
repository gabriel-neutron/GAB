// The text of a document is derived and private. One set of pages for each document and extractor
// version, written once through one door. Each gesture below runs inside a transaction that rolls
// back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const SHA = 'b'.repeat(64);
const WITH_BYTES = 'doc_b17e01';
const NO_BYTES = 'doc_b17e02';

const rolledBack = <T>(work: (ask: Ask) => Promise<T>): Promise<T> =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      return await work(ask);
    } finally {
      await ask('ROLLBACK');
    }
  });

const PUT = 'SELECT public.put_document_text($1, $2::jsonb, $3) AS n';

const counts = z.array(z.object({ n: z.number().int() }));
const pages = z.array(z.object({ page: z.number().int(), text: z.string() }));

const stored = async (ask: Ask): Promise<void> => {
  await ask(
    `INSERT INTO public.documents (id, kind, title, s3_key, sha256, mime, retrieved_at)
     VALUES ($1, 'file', 'a report', 'raw/b17e01', $2, 'application/pdf', current_date)`,
    [WITH_BYTES, SHA],
  );
  await ask(
    `INSERT INTO public.documents (id, kind, title, uri, retrieved_at)
     VALUES ($1, 'url', 'an address', 'https://example.org/a', current_date)`,
    [NO_BYTES],
  );
};

const put = async (
  ask: Ask,
  role: string,
  document: string,
  set: unknown,
  extractor = 'text-1',
): Promise<number> => {
  await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
  const [row] = counts.parse(await ask(PUT, [document, JSON.stringify(set), extractor]));
  await ask('RESET SESSION AUTHORIZATION');
  return row?.n ?? -1;
};

const rowsOf = async (ask: Ask, extractor = 'text-1') =>
  pages.parse(
    await ask(
      `SELECT page, text FROM public.document_text
        WHERE document_id = $1 AND extractor = $2 ORDER BY page`,
      [WITH_BYTES, extractor],
    ),
  );

test('a set of pages is stored with the page number set by position', async () => {
  const held = await rolledBack(async (ask) => {
    await stored(ask);
    const n = await put(ask, 'gabriel_app', WITH_BYTES, ['one', '', 'three']);
    return { n, rows: await rowsOf(ask) };
  });
  expect(held.n).toBe(3);
  expect(held.rows).toStrictEqual([
    { page: 1, text: 'one' },
    { page: 2, text: '' },
    { page: 3, text: 'three' },
  ]);
});

test('gabriel_agent may call the door', async () => {
  const n = await rolledBack(async (ask) => {
    await stored(ask);
    return put(ask, 'gabriel_agent', WITH_BYTES, ['one']);
  });
  expect(n).toBe(1);
});

test('a second set for the same document and extractor is refused', async () => {
  await expect(
    rolledBack(async (ask) => {
      await stored(ask);
      await put(ask, 'gabriel_app', WITH_BYTES, ['one']);
      await put(ask, 'gabriel_app', WITH_BYTES, ['one', 'two']);
    }),
  ).rejects.toMatchObject({ code: '23505' });
});

test('a second extractor version of the same document is stored beside the first', async () => {
  const n = await rolledBack(async (ask) => {
    await stored(ask);
    await put(ask, 'gabriel_app', WITH_BYTES, ['one']);
    await put(ask, 'gabriel_app', WITH_BYTES, ['one', 'two'], 'text-2');
    return (await rowsOf(ask, 'text-2')).length;
  });
  expect(n).toBe(2);
});

test('a document with no bytes is refused', async () => {
  await expect(
    rolledBack(async (ask) => {
      await stored(ask);
      await put(ask, 'gabriel_app', NO_BYTES, ['one']);
    }),
  ).rejects.toThrow(/holds no bytes/);
});

test('a document that does not exist is refused', async () => {
  await expect(
    rolledBack((ask) => put(ask, 'gabriel_app', 'doc_000000', ['one'])),
  ).rejects.toMatchObject({ code: '23503' });
});

test('a refused second set leaves the first set whole', async () => {
  const held = await rolledBack(async (ask) => {
    await stored(ask);
    await put(ask, 'gabriel_app', WITH_BYTES, ['one']);
    await ask('SAVEPOINT s');
    await put(ask, 'gabriel_app', WITH_BYTES, ['x', 'y']).catch(() => undefined);
    await ask('ROLLBACK TO s');
    return rowsOf(ask);
  });
  expect(held).toStrictEqual([{ page: 1, text: 'one' }]);
});

test.each(['gabriel_app', 'gabriel_agent'])('%s cannot write the table directly', async (role) => {
  await expect(
    rolledBack(async (ask) => {
      await stored(ask);
      await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
      await ask(
        `INSERT INTO public.document_text (document_id, extractor, page, text)
         VALUES ($1, 'text-1', 1, 'x')`,
        [WITH_BYTES],
      );
    }),
  ).rejects.toMatchObject({ code: '42501' });
});

test.each(['gabriel_app', 'gabriel_agent'])('%s reads the table', async (role) => {
  const n = await rolledBack(async (ask) => {
    await stored(ask);
    await put(ask, 'gabriel_app', WITH_BYTES, ['one']);
    await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
    return counts.parse(
      await ask('SELECT count(*)::int AS n FROM public.document_text WHERE document_id = $1', [
        WITH_BYTES,
      ]),
    )[0]?.n;
  });
  expect(n).toBe(1);
});

test('gabriel_read cannot read the table', async () => {
  await expect(
    rolledBack(async (ask) => {
      await ask('SET LOCAL SESSION AUTHORIZATION gabriel_read');
      await ask('SELECT 1 FROM public.document_text');
    }),
  ).rejects.toMatchObject({ code: '42501' });
});

test('the table holds no project_id and no api view shows it', async () => {
  const found = await rolledBack(
    async (ask) =>
      z.array(z.object({ n: z.number().int() })).parse(
        await ask(
          `SELECT ((SELECT count(*) FROM information_schema.columns
                    WHERE table_name = 'document_text' AND column_name = 'project_id')
                + (SELECT count(*) FROM information_schema.views
                    WHERE table_schema = 'api' AND view_definition ~* 'document_text'))::int AS n`,
        ),
      )[0]?.n,
  );
  expect(found).toBe(0);
});
