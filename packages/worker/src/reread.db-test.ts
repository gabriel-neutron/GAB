import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { extractText } from '@gab/text';
import { Pool, type PoolClient } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { roleAddress } from './address.ts';
import { rereadHtml, type RereadReport } from './reread.ts';

// Departure: each test runs in one transaction that rolls back. The owner seeds the documents as
// the fetch tool stored them before PR #416, the research role cites one, and the command runs as
// gabriel_app. The raw store is a map of keys to bytes.
z.object({ GABRIEL_DATABASE: z.literal('gabriel_test') }).parse(process.env);
const pool = new Pool({ connectionString: roleAddress('gabriel', 'POSTGRES_PASSWORD'), max: 2 });

afterAll(async () => {
  await pool.end();
});

const CYRILLIC = await readFile(join(import.meta.dirname, '../../text/fixtures/windows-1251.html'));
const PLAIN_URI = 'https://forum.example.org/topic/1';
const OLD_SET = 'text-1';
const NOW = new Date('2026-10-09T18:00:00Z');

const utf8 = (html: string): Uint8Array => new TextEncoder().encode(html);

// The reading of the fetch tool before PR #416: every HTML page as UTF-8.
const oldPages = async (bytes: Uint8Array) =>
  (await extractText(bytes, 'text/html; charset=utf-8')).pages;

type Ask = (text: string, values?: unknown[]) => Promise<unknown[]>;

interface Held {
  readonly ask: Ask;
  /** Stores a document with its bytes, its title and its text, and gives its id. */
  readonly put: (
    bytes: Uint8Array,
    title: string,
    pages: readonly string[],
    uri?: string,
  ) => Promise<string>;
  readonly run: (dryRun: boolean, broken?: string) => Promise<RereadReport>;
}

const inTransaction = async (work: (held: Held) => Promise<void>): Promise<void> => {
  const client: PoolClient = await pool.connect();
  const objects = new Map<string, Uint8Array>();
  try {
    await client.query('BEGIN');
    const ask: Ask = async (text, values = []) => {
      const found: { rows: unknown[] } = await client.query(text, values);
      return found.rows;
    };
    await work({
      ask,
      put: async (bytes, title, pages, uri = PLAIN_URI) => {
        const sha = createHash('sha256').update(bytes).digest('hex');
        const key = `raw/${sha}`;
        objects.set(key, bytes);
        const [row] = z.array(z.object({ id: z.string() })).parse(
          await ask(
            `SELECT public.put_fetched_document('url', $1, $2, $3, $4, 'text/html',
               '2026-10-01'::date)::text AS id`,
            [title, key, uri, sha],
          ),
        );
        const id = row?.id ?? '';
        await ask('SELECT public.put_document_text($1, $2::jsonb, $3)', [
          id,
          JSON.stringify(pages),
          OLD_SET,
        ]);
        return id;
      },
      run: async (dryRun, broken) => {
        await client.query('SET LOCAL SESSION AUTHORIZATION gabriel_app');
        try {
          return await rereadHtml(
            {
              db: client,
              read: (key) => {
                const bytes = objects.get(key);
                if (bytes === undefined || key === broken)
                  return Promise.reject(new Error('the raw store did not give the object'));
                return Promise.resolve(bytes);
              },
              now: () => NOW,
            },
            dryRun,
          );
        } finally {
          await client.query('RESET SESSION AUTHORIZATION');
        }
      },
    });
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
};

const documentOf = async (held: Held, id: string) =>
  z
    .array(
      z.object({
        title: z.string(),
        uri: z.string().nullable(),
        sha256: z.string().nullable(),
        retrieved_at: z.string().nullable(),
        sets: z.number(),
        newest: z.string().nullable(),
      }),
    )
    .parse(
      await held.ask(
        `SELECT d.title, d.uri, d.sha256, d.retrieved_at::text AS retrieved_at,
                (SELECT count(DISTINCT t.extractor)::int FROM public.document_text t
                  WHERE t.document_id = d.id) AS sets,
                (SELECT string_agg(t.text, '' ORDER BY t.page) FROM public.document_text t
                  WHERE t.document_id = d.id
                    AND t.extractor = public.newest_text_extractor(d.id::text)) AS newest
           FROM public.documents d WHERE d.id = $1`,
        [id],
      ),
    )[0];

// One act of the research AI that cites the start of the first page of a document.
const cite = async (held: Held, document: string, length: number): Promise<string> => {
  const item = {
    id: randomUUID(),
    op: 'create_entity',
    payload: { type: 'military_unit', label: `Unit ${randomUUID()}`, sources: [document] },
    src: [document],
    names: [],
    model_call_id: null,
    originator: 'A forum',
    modality: 'asserts',
    citations: [{ document, text_extractor: OLD_SET, page: 1, start: 0, end: length }],
  };
  await held.ask('SET LOCAL SESSION AUTHORIZATION gabriel_research');
  await held.ask('SELECT proposal_id FROM public.propose_batch($1::jsonb)', [
    JSON.stringify([item]),
  ]);
  await held.ask('RESET SESSION AUTHORIZATION');
  const [row] = z
    .array(z.object({ id: z.string() }))
    .parse(
      await held.ask('SELECT id::text AS id FROM public.citation WHERE doc_id = $1', [document]),
    );
  return row?.id ?? '';
};

const GARBLED_TITLE = '����� � ����';

test('a windows-1251 page with a garbled text gets its Cyrillic text and title, and nothing else changes', async () => {
  await inTransaction(async (held) => {
    const id = await held.put(CYRILLIC, GARBLED_TITLE, await oldPages(CYRILLIC));
    const before = await documentOf(held, id);
    expect(before?.newest).not.toContain('Судоходная');

    const report = await held.run(false);

    expect(report.changed).toStrictEqual([
      { document: id, text: true, title: { from: GARBLED_TITLE, to: 'Форум — Тема' } },
    ]);
    const after = await documentOf(held, id);
    expect(after?.title).toBe('Форум — Тема');
    expect(after?.newest).toContain('Судоходная компания');
    expect(after?.newest).toContain('Ёлка, щука');
    // The old set stays for its citations, and the bytes, the address and the date stay.
    expect(after?.sets).toBe(2);
    expect({ ...after, title: '', newest: '', sets: 0 }).toStrictEqual({
      ...before,
      title: '',
      newest: '',
      sets: 0,
    });
  });
});

test('a document that was correct stays the same', async () => {
  await inTransaction(async (held) => {
    const bytes = utf8(
      '<html><head><title>A port notice</title></head><body><p>The tanker left.</p></body></html>',
    );
    const id = await held.put(bytes, 'A port notice', await oldPages(bytes));
    const before = await documentOf(held, id);

    const report = await held.run(false);

    expect(report.changed).toStrictEqual([]);
    expect(report.read).toBe(1);
    expect(await documentOf(held, id)).toStrictEqual(before);
  });
});

test('the dry run gives the changes and writes nothing', async () => {
  await inTransaction(async (held) => {
    const id = await held.put(CYRILLIC, GARBLED_TITLE, await oldPages(CYRILLIC));
    const before = await documentOf(held, id);

    const report = await held.run(true);

    expect(report.dryRun).toBe(true);
    expect(report.changed.map((one) => one.document)).toStrictEqual([id]);
    expect(await documentOf(held, id)).toStrictEqual(before);
  });
});

test('a second run changes nothing', async () => {
  await inTransaction(async (held) => {
    const id = await held.put(CYRILLIC, GARBLED_TITLE, await oldPages(CYRILLIC));
    await held.run(false);
    const after = await documentOf(held, id);

    expect((await held.run(false)).changed).toStrictEqual([]);
    expect(await documentOf(held, id)).toStrictEqual(after);
  });
});

test('a title that the old reading did not give stays', async () => {
  await inTransaction(async (held) => {
    const id = await held.put(CYRILLIC, 'A title of the operator', await oldPages(CYRILLIC));

    const report = await held.run(false);

    expect(report.changed).toStrictEqual([{ document: id, text: true, title: null }]);
    expect((await documentOf(held, id))?.title).toBe('A title of the operator');
  });
});

test('a render is read as UTF-8, and its title follows the title of its page', async () => {
  await inTransaction(async (held) => {
    await held.put(CYRILLIC, GARBLED_TITLE, await oldPages(CYRILLIC));
    // The browser gives the render as a string, and its meta still names windows-1251.
    const html = new TextDecoder('windows-1251').decode(CYRILLIC);
    const render = utf8(html);
    const pages = (await extractText(render, 'text/html; charset=utf-8')).pages;
    const id = await held.put(render, `${GARBLED_TITLE} (rendered)`, pages);

    const report = await held.run(false);

    expect(report.changed.find((one) => one.document === id)).toStrictEqual({
      document: id,
      text: false,
      title: { from: `${GARBLED_TITLE} (rendered)`, to: 'Форум — Тема (rendered)' },
    });
    const after = await documentOf(held, id);
    expect(after?.sets).toBe(1);
    expect(after?.newest).toContain('Судоходная компания');
  });
});

test('a document with a citation that the new text would break stays unchanged and is listed, and the others change', async () => {
  await inTransaction(async (held) => {
    const cited = await held.put(CYRILLIC, GARBLED_TITLE, await oldPages(CYRILLIC));
    const citation = await cite(held, cited, 10);
    const other = Buffer.concat([CYRILLIC, utf8('<!-- a second fetch -->')]);
    const free = await held.put(other, GARBLED_TITLE, await oldPages(other), `${PLAIN_URI}/2`);
    // The render of the kept page keeps its title too.
    const render = utf8(new TextDecoder('windows-1251').decode(CYRILLIC));
    await held.put(
      render,
      `${GARBLED_TITLE} (rendered)`,
      (await extractText(render, 'text/html; charset=utf-8')).pages,
    );
    const before = await documentOf(held, cited);
    const kept = [{ document: cited, citations: [{ citation, page: 1 }] }];

    const dry = await held.run(true);
    expect(dry.kept).toStrictEqual(kept);
    expect(dry.changed.map((one) => one.document)).toStrictEqual([free]);

    const report = await held.run(false);

    expect(report.kept).toStrictEqual(kept);
    expect(report.changed.map((one) => one.document)).toStrictEqual([free]);
    expect(await documentOf(held, cited)).toStrictEqual(before);
    expect((await documentOf(held, free))?.title).toBe('Форум — Тема');
    expect(
      await held.ask('SELECT text_extractor FROM public.citation WHERE id = $1::uuid', [citation]),
    ).toStrictEqual([{ text_extractor: OLD_SET }]);
  });
});

test('a cited document whose excerpt the corrected text still holds changes', async () => {
  await inTransaction(async (held) => {
    // The old text starts with a heading that the corrected text also holds.
    const fresh = (await extractText(CYRILLIC, 'text/html')).pages;
    const id = await held.put(CYRILLIC, GARBLED_TITLE, [`${fresh[0] ?? ''} garbled`]);
    const citation = await cite(held, id, 10);

    const report = await held.run(false);

    expect(report.kept).toStrictEqual([]);
    expect(report.changed).toStrictEqual([
      { document: id, text: true, title: { from: GARBLED_TITLE, to: 'Форум — Тема' } },
    ]);
    expect((await documentOf(held, id))?.sets).toBe(2);
    expect(
      await held.ask('SELECT text_extractor FROM public.citation WHERE id = $1::uuid', [citation]),
    ).toStrictEqual([{ text_extractor: OLD_SET }]);
  });
});

test('a document that cannot be read is counted with its reason, and the others go on', async () => {
  await inTransaction(async (held) => {
    const broken = await held.put(utf8('<html><body><p>Gone.</p></body></html>'), 'Gone', [
      'Gone.',
    ]);
    const fixed = await held.put(CYRILLIC, GARBLED_TITLE, await oldPages(CYRILLIC));
    const [row] = z
      .array(z.object({ s3_key: z.string() }))
      .parse(await held.ask('SELECT s3_key FROM public.documents WHERE id = $1', [broken]));

    const report = await held.run(false, row?.s3_key);

    expect(report.failed).toStrictEqual([
      { document: broken, reason: 'the raw store did not give the object' },
    ]);
    expect(report.changed.map((one) => one.document)).toStrictEqual([fixed]);
  });
});

// The bytes of the windows-1251 title of the fixture.
const TITLE_BYTES = ((): Uint8Array => {
  const ascii = new TextDecoder('latin1').decode(CYRILLIC);
  return CYRILLIC.subarray(ascii.indexOf('<title>') + 7, ascii.indexOf('</title>'));
})();

// A page of one script: its text is empty, and only its render holds the text.
const SHELL = new Uint8Array([
  ...utf8('<html><head><meta charset="windows-1251"><title>'),
  ...TITLE_BYTES,
  ...utf8('</title></head><body><script>run()</script></body></html>'),
]);

const garbledTitleOf = (bytes: Uint8Array): string => {
  const found = /<title>([\s\S]*?)<\/title>/u.exec(new TextDecoder('utf-8').decode(bytes))?.[1];
  return found ?? '';
};

test('a page of one script, and its render, get their corrected titles', async () => {
  await inTransaction(async (held) => {
    const garbled = garbledTitleOf(SHELL);
    const page = await held.put(SHELL, garbled, await oldPages(SHELL));
    const html = new TextDecoder('windows-1251').decode(CYRILLIC);
    const render = utf8(html);
    const rendered = await held.put(
      render,
      `${garbled} (rendered)`,
      (await extractText(render, 'text/html; charset=utf-8')).pages,
    );

    const report = await held.run(false);

    expect(report.failed).toStrictEqual([]);
    const titleOfPage = (await documentOf(held, page))?.title ?? '';
    expect(titleOfPage).not.toContain('�');
    expect(report.changed).toMatchObject([
      { document: page, title: { from: garbled, to: titleOfPage } },
      {
        document: rendered,
        text: false,
        title: { from: `${garbled} (rendered)`, to: `${titleOfPage} (rendered)` },
      },
    ]);
    expect((await held.run(false)).changed).toStrictEqual([]);
  });
});

test('a render whose title lost its end is read as UTF-8, and its correct text stays', async () => {
  await inTransaction(async (held) => {
    const render = utf8(new TextDecoder('windows-1251').decode(CYRILLIC));
    const pages = (await extractText(render, 'text/html; charset=utf-8')).pages;
    const id = await held.put(render, `${'A long title '.repeat(40)} (rende`, pages);
    const before = await documentOf(held, id);

    const report = await held.run(false);

    expect(report.changed).toStrictEqual([]);
    expect(await documentOf(held, id)).toStrictEqual(before);
  });
});

test('a render finds the titles of its own page when two pages have its address', async () => {
  await inTransaction(async (held) => {
    const other = utf8(
      '<html><head><title>A later page</title></head><body><p>Later.</p></body></html>',
    );
    await held.put(CYRILLIC, GARBLED_TITLE, await oldPages(CYRILLIC));
    await held.put(other, 'A later page', await oldPages(other));
    const render = utf8(new TextDecoder('windows-1251').decode(CYRILLIC));
    const id = await held.put(
      render,
      `${GARBLED_TITLE} (rendered)`,
      (await extractText(render, 'text/html; charset=utf-8')).pages,
    );

    await held.run(false);

    expect((await documentOf(held, id))?.title).toBe('Форум — Тема (rendered)');
  });
});

test('a page whose reading gives no text is no fault, and it gets no new text set', async () => {
  await inTransaction(async (held) => {
    const id = await held.put(utf8('<html><body><script>run()</script></body></html>'), 'A shell', [
      '',
    ]);

    const report = await held.run(false);

    expect(report.failed).toStrictEqual([]);
    expect(report.changed).toStrictEqual([]);
    expect((await documentOf(held, id))?.sets).toBe(1);
  });
});
