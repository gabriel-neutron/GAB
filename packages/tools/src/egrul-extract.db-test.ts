// A register extract stays internal, and an excerpt of it can name a legal person only. Each test
// runs inside a transaction that rolls back. Each name and number is invented.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { as } from '../../../tools/author-fixture.ts';
import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { proposeOf } from './propose.ts';
import { callTool, type Session } from './tool.ts';

const sessionOf = (ask: Ask): Session => ({
  query: async (text, values) => ({ rows: await ask(text, values) }),
});

const STORE =
  'SELECT public.put_fetched_document($1, $2, $3, $4, $5, $6, $7::date, NULL, $8) AS id';
const WRITE_TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3) AS pages';
// The door of a fetched document accepts only today or yesterday.
const TODAY = new Date().toISOString().slice(0, 10);

const OWNER = 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "ВЛАДЕЛЕЦ"';
const PERSON = 'КРАСНОВ';
const TEXT = `Сведения об участниках / учредителях юридического лица
21 ОГРН 5000000000001
23 Полное наименование ${OWNER}
28 Фамилия
Имя
Отчество
${PERSON}
ПЁТР
СИДОРОВИЧ
Сведения об учете в налоговом органе`;

const store = async (
  ask: Ask,
  number: number,
  uri: string,
  provider: string | null,
): Promise<string> => {
  const sha = number.toString(16).padStart(2, '0').repeat(32);
  const id = `doc_${sha.slice(0, 12)}`;
  await as(ask, 'gabriel_research', async () => {
    await ask(STORE, [
      'api',
      'An extract',
      `raw/${sha}`,
      uri,
      sha,
      'application/pdf',
      TODAY,
      provider,
    ]);
    await ask(WRITE_TEXT, [id, JSON.stringify([TEXT]), 'egrul-test-1']);
  });
  return id;
};

const EGRUL = 'https://egrul.nalog.ru/index.html#7700000011';

const released = z.array(z.object({ id: z.string() }));

test('a release holds no extract of the provider egrul', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const extract = await store(ask, 61, EGRUL, 'egrul');
    const comtrade = await store(ask, 62, 'https://comtrade.example/1', 'un_comtrade');
    const free = await store(ask, 63, 'https://example.org/open', 'gleif');
    const rows = released.parse(await ask('SELECT id FROM public.release_documents()'));
    const ids = new Set(rows.map((row) => row.id));
    const open = released.parse(await ask('SELECT id::text AS id FROM public.public_document'));
    return {
      extract: ids.has(extract) || open.some((row) => row.id === extract),
      free: ids.has(free),
      // This ticket changes the rule of no other provider. BLD-07 decides the other restricted ones.
      comtrade: ids.has(comtrade),
    };
  });
  expect(found).toStrictEqual({ extract: false, free: true, comtrade: true });
});

const propose = (ask: Ask, document: string, excerpt: string) =>
  as(ask, 'gabriel_research', () =>
    callTool(proposeOf(null), sessionOf(ask), {
      items: [
        {
          ref: 'owner',
          act: { op: 'create_entity', type: 'company', label: 'Vladelets' },
          originator: 'The Russian register',
          modality: 'asserts',
          evidence: [{ document, page: 1, excerpt }],
        },
      ],
    }),
  );

for (const [name, uri, provider] of [
  ['the tool', EGRUL, 'egrul'],
  ['another tool, with no provider', 'https://egrul.nalog.ru/vyp-download/abc', null],
] as const)
  test(`propose refuses an excerpt that names a natural person, in a document of ${name}`, async () => {
    const outcome = await rolledBack('superuser', async (ask) => {
      const document = await store(ask, 64, uri, provider);
      return propose(ask, document, PERSON);
    });
    expect(outcome).toMatchObject({ ok: false });
    expect(outcome.ok ? '' : outcome.refusal).toMatch(/sign of a natural person/u);
    expect(outcome.ok ? '' : outcome.refusal).not.toContain(PERSON);
  });

test('propose takes an excerpt with the name of a legal person', async () => {
  const outcome = await rolledBack('superuser', async (ask) => {
    const document = await store(ask, 65, EGRUL, 'egrul');
    return propose(ask, document, OWNER);
  });
  expect(outcome.ok ? '' : outcome.refusal).not.toMatch(/register extract/u);
});

test('the same words pass in a document of another host', async () => {
  const outcome = await rolledBack('superuser', async (ask) => {
    const document = await store(ask, 66, 'https://example.org/page', null);
    return propose(ask, document, PERSON);
  });
  expect(outcome.ok ? '' : outcome.refusal).not.toMatch(/register extract/u);
});
