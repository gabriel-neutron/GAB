// A restricted document never leaves, and an excerpt of it can name a legal person only. Each test
// runs inside a transaction that rolls back. Each name and number is invented.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { as } from '../../../tools/author-fixture.ts';
import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { restrictedExcerptRefusal } from './egrul-text.ts';
import { proposeOf } from './propose.ts';
import { callTool, type Session } from './tool.ts';

const sessionOf = (ask: Ask): Session => ({
  query: async (text, values) => ({ rows: await ask(text, values) }),
});

const COMPANY = 'Test Plant LLC';
const PERSON = 'Ivan Testov';
const LEGAL = `${COMPANY} delivered the goods.`;
const NAMED = `${PERSON} signed for the goods.`;
const TEXT = `${LEGAL}\n${NAMED}`;
const TODAY = new Date().toISOString().slice(0, 10);

const store = async (ask: Ask, number: number, uri: string): Promise<string> => {
  const sha = number.toString(16).padStart(2, '0').repeat(32);
  const id = `doc_${sha.slice(0, 12)}`;
  await as(ask, 'gabriel_research', async () => {
    await ask(
      'SELECT public.put_fetched_document($1, $2, $3, $4, $5, $6, $7::date, NULL, $8) AS id',
      ['url', 'A test act', `raw/${sha}`, uri, sha, 'text/plain', TODAY, null],
    );
    await ask('SELECT public.put_document_text($1, $2::jsonb, $3) AS pages', [
      id,
      JSON.stringify([TEXT]),
      'restricted-test-1',
    ]);
  });
  return id;
};

const propose = (ask: Ask, document: string, excerpt: string) =>
  as(ask, 'gabriel_research', () =>
    callTool(proposeOf(null), sessionOf(ask), {
      items: [
        {
          ref: 'firm',
          act: { op: 'create_entity', type: 'company', label: 'Test Plant' },
          originator: 'A test court',
          modality: 'asserts',
          evidence: [{ document, page: 1, excerpt }],
        },
      ],
    }),
  );

const sign = /sign of a natural person/u;

test.each([
  'IVAN TESTOV signed for TEST PLANT LLC.',
  'Testov signed for Test Plant LLC.',
  'Иван Иванов ООО "Ромашка".',
  'ООО "Ромашка" в лице Иванова',
  'I. Testov and Test Plant LLC',
  'Test Plant LLC and Testov I.',
  'Сидоров А. и ООО "Ромашка"',
  'Ivan Testov, Test Plant LLC',
])('the rule refuses an excerpt that names a person: %s', (excerpt) => {
  expect(restrictedExcerptRefusal(excerpt)).toMatch(sign);
});

test.each([
  'Test Plant LLC delivered the goods.',
  'TEST PLANT LLC delivered the goods.',
  'ООО "Ромашка" поставило станки АО «Завод»',
  'поставщик Общество с ограниченной ответственностью "Ромашка"',
  'the goods of Test Bank went to Second Plant Ltd.',
  'ОГРН 1027700132195',
])('the rule takes an excerpt on a legal person: %s', (excerpt) => {
  expect(restrictedExcerptRefusal(excerpt)).toBeNull();
});
const SUDACT = 'https://sudact.ru/arbitral/doc/test1/';

test('an excerpt that names a person is refused, on each way to the class', async () => {
  const outcomes = await rolledBack('superuser', async (ask) => {
    const byRule = await store(ask, 71, SUDACT);
    const copy = await store(ask, 72, `https://web.archive.org/web/2024id_/${SUDACT}`);
    const marked = await store(ask, 73, 'https://bank.example/statement.pdf');
    const dotted = await store(ask, 78, 'https://sudact.ru./arbitral/doc/x/');
    const encoded = await store(
      ask,
      79,
      'https://web.archive.org/web/2024/https%3A%2F%2Fsudact.ru%2Farbitral%2Fdoc%2Fx%2F',
    );
    await as(ask, 'gabriel_research', () =>
      ask('SELECT public.fill_document_restricted($1) AS outcome', [marked]),
    );
    return [
      await propose(ask, byRule, NAMED),
      await propose(ask, copy, NAMED),
      await propose(ask, marked, NAMED),
      await propose(ask, dotted, NAMED),
      await propose(ask, encoded, NAMED),
    ];
  });
  for (const outcome of outcomes) {
    expect(outcome.ok ? '' : outcome.refusal).toMatch(sign);
    expect(outcome.ok ? '' : outcome.refusal).not.toContain(PERSON);
  }
});

test('an excerpt that names a legal person passes the rule', async () => {
  const outcome = await rolledBack('superuser', async (ask) =>
    propose(ask, await store(ask, 74, SUDACT), LEGAL),
  );
  expect(outcome.ok ? '' : outcome.refusal).not.toMatch(/restricted document/u);
});

test('an excerpt of a document outside the class can name a person', async () => {
  const outcome = await rolledBack('superuser', async (ask) =>
    propose(ask, await store(ask, 75, 'https://example.org/article'), NAMED),
  );
  expect(outcome.ok ? '' : outcome.refusal).not.toMatch(sign);
});

test('a restricted document is no source of a new natural person', async () => {
  const outcome = await rolledBack('superuser', async (ask) => {
    const document = await store(ask, 76, SUDACT);
    return as(ask, 'gabriel_research', () =>
      callTool(proposeOf(null), sessionOf(ask), {
        items: [
          {
            ref: 'person',
            act: { op: 'create_entity', type: 'person', label: 'A Person' },
            originator: 'A test court',
            modality: 'asserts',
            evidence: [{ document, page: 1, excerpt: LEGAL }],
          },
        ],
      }),
    );
  });
  expect(outcome.ok ? '' : outcome.refusal).toMatch(/no source of a natural person/u);
});

const mark = z.array(z.object({ level: z.string(), restricted: z.boolean() }));

test('a tool role reads the level and the class, and no role can remove the mark', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const id = await store(ask, 77, 'https://example.org/statement');
    const before = await as(ask, 'gabriel_research', () =>
      ask(
        'SELECT public.document_level($1) AS level, public.document_restricted($1) AS restricted',
        [id],
      ),
    );
    await as(ask, 'gabriel_research', () =>
      ask('SELECT public.fill_document_restricted($1) AS outcome', [id]),
    );
    const after = await as(ask, 'gabriel_research', () =>
      ask(
        'SELECT public.document_level($1) AS level, public.document_restricted($1) AS restricted',
        [id],
      ),
    );
    const open = await ask('SELECT 1 FROM public.public_document WHERE id = $1', [id]);
    return { before: mark.parse(before), after: mark.parse(after), open: open.length };
  });
  expect(found).toStrictEqual({
    before: [{ level: 'not_verified', restricted: false }],
    after: [{ level: 'not_verified', restricted: true }],
    open: 0,
  });
});
