// A conversation is the operator's own, and a stored answer names its model call and its
// sources. Each gesture below runs inside a transaction that rolls back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const SHA = 'a'.repeat(64);
const DOCUMENT = 'doc_8f2a41';

const ids = z.array(z.object({ id: z.uuid() }));
const counts = z.array(z.object({ n: z.number().int() }));

const rolledBack = <T>(work: (ask: Ask) => Promise<T>): Promise<T> =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      return await work(ask);
    } finally {
      await ask('ROLLBACK');
    }
  });

const one = async (ask: Ask, text: string, values: unknown[] = []): Promise<string> => {
  const [row] = ids.parse(await ask(text, values));
  if (row === undefined) throw new Error('no row came back');
  return row.id;
};

const as = async (
  ask: Ask,
  role: string,
  text: string,
  values: unknown[] = [],
): Promise<string> => {
  await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
  const id = await one(ask, text, values);
  await ask('RESET SESSION AUTHORIZATION');
  return id;
};

const OPEN = 'SELECT public.open_conversation($1, $2, $3::uuid) AS id';
const APPEND = 'SELECT public.append_chat_message($1::uuid, $2, $3, $4::uuid, $5::jsonb) AS id';

const opened = (ask: Ask, title = 'Which registries after 2025?'): Promise<string> =>
  as(ask, 'gabriel_app', OPEN, [title, null, null]);

const called = (ask: Ask): Promise<string> =>
  as(
    ask,
    'gabriel_agent',
    `SELECT public.record_model_call('chat', 'v1', 'e', 'm', $1, 1, 'ok') AS id`,
    [SHA],
  );

const entityOf = (ask: Ask): Promise<string> => one(ask, 'SELECT id FROM public.entities LIMIT 1');
const relationOf = (ask: Ask): Promise<string> =>
  one(ask, 'SELECT id FROM public.relations LIMIT 1');

const appended = (
  ask: Ask,
  conversation: string,
  role: string,
  text: string,
  call: string | null,
  citations: unknown,
): Promise<string> =>
  as(ask, 'gabriel_app', APPEND, [conversation, role, text, call, JSON.stringify(citations)]);

const count = async (ask: Ask, table: string): Promise<number> =>
  counts.parse(await ask(`SELECT count(*)::int AS n FROM public.${table}`))[0]?.n ?? -1;

// E1
test('an assistant message with citations is stored in one transaction', async () => {
  const stored = await rolledBack(async (ask) => {
    const conversation = await opened(ask);
    const call = await called(ask);
    const entity = await entityOf(ask);
    const relation = await relationOf(ask);
    const message = await appended(
      ask,
      conversation,
      'assistant',
      'It used two registries.',
      call,
      [
        { kind: 'document', id: DOCUMENT, excerpt: 'a line of the registry' },
        { kind: 'entity', id: entity },
        { kind: 'relation', id: relation },
      ],
    );
    return {
      cited: await count(ask, 'chat_citation'),
      messages: await ask('SELECT model_call_id FROM public.chat_message WHERE id = $1::uuid', [
        message,
      ]),
      call,
    };
  });
  expect(stored.cited).toBe(3);
  expect(stored.messages).toStrictEqual([{ model_call_id: stored.call }]);
});

// E2
test('a citation of a document that does not exist refuses the whole message', async () => {
  const outcome = await rolledBack(async (ask) => {
    const conversation = await opened(ask);
    const call = await called(ask);
    const entity = await entityOf(ask);
    await ask('SAVEPOINT before_message');
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
    let code: unknown;
    try {
      await ask(APPEND, [
        conversation,
        'assistant',
        'An answer.',
        call,
        JSON.stringify([
          { kind: 'entity', id: entity },
          { kind: 'document', id: 'doc_nothing_here' },
        ]),
      ]);
    } catch (error) {
      code = (error as { code?: unknown }).code;
    }
    await ask('ROLLBACK TO SAVEPOINT before_message');
    await ask('RESET SESSION AUTHORIZATION');
    return {
      code,
      messages: await count(ask, 'chat_message'),
      citations: await count(ask, 'chat_citation'),
    };
  });
  expect(outcome).toStrictEqual({ code: '23503', messages: 0, citations: 0 });
});

// E3
const FROZEN = [
  { verb: 'UPDATE', text: "UPDATE public.chat_message SET body = 'changed'" },
  { verb: 'DELETE', text: 'DELETE FROM public.chat_message' },
] as const;

for (const { verb, text } of FROZEN)
  test(`the superuser cannot ${verb} a row: ${text}`, async () => {
    await expect(
      rolledBack(async (ask) => {
        const conversation = await opened(ask);
        await appended(ask, conversation, 'user', 'A question.', null, []);
        const call = await called(ask);
        await appended(ask, conversation, 'assistant', 'An answer.', call, [
          { kind: 'document', id: DOCUMENT, excerpt: 'a line' },
        ]);
        return ask(text);
      }),
    ).rejects.toThrow(/is never (updated|deleted)/);
  });

// E4
test('an assistant message with no model call, and a user message with one, are refused', async () => {
  await expect(
    rolledBack(async (ask) =>
      appended(ask, await opened(ask), 'assistant', 'An answer.', null, []),
    ),
  ).rejects.toMatchObject({ code: '23514', constraint: 'chat_message_call_iff_assistant' });
  await expect(
    rolledBack(async (ask) =>
      appended(ask, await opened(ask), 'user', 'A question.', await called(ask), []),
    ),
  ).rejects.toMatchObject({ code: '23514', constraint: 'chat_message_call_iff_assistant' });
});

// E6
const SHAPES: readonly [string, unknown][] = [
  ['a key outside the closed set', [{ kind: 'document', id: DOCUMENT, note: 'x' }]],
  ['a kind outside the closed set', [{ kind: 'person', id: DOCUMENT }]],
  ['a missing id', [{ kind: 'document' }]],
  ['a list that is not an array', { kind: 'document', id: DOCUMENT }],
  ['a blank excerpt', [{ kind: 'document', id: DOCUMENT, excerpt: '  ' }]],
];

for (const [name, shape] of SHAPES)
  test(`a citation list with ${name} is refused`, async () => {
    await expect(
      rolledBack(async (ask) =>
        appended(ask, await opened(ask), 'assistant', 'An answer.', await called(ask), shape),
      ),
    ).rejects.toThrow();
  });

test('a conversation anchors on a real entity, a real relation or nothing', async () => {
  const anchored = await rolledBack(async (ask) => {
    const entity = await entityOf(ask);
    await as(ask, 'gabriel_app', OPEN, ['An entity chat', 'entity', entity]);
    await as(ask, 'gabriel_app', OPEN, ['A relation chat', 'relation', await relationOf(ask)]);
    await as(ask, 'gabriel_app', OPEN, ['A project chat', null, null]);
    return count(ask, 'conversation');
  });
  expect(anchored).toBe(3);
  await expect(
    rolledBack((ask) =>
      as(ask, 'gabriel_app', OPEN, ['A ghost chat', 'entity', crypto.randomUUID()]),
    ),
  ).rejects.toMatchObject({ code: '23503' });
});

const BLANKS: readonly (readonly [string | null, string])[] = [
  [null, '23502'],
  ['', '23514'],
  ['  \t', '23514'],
];

for (const [value, code] of BLANKS) {
  test(`open_conversation refuses the title ${JSON.stringify(value)}`, async () => {
    await expect(
      rolledBack((ask) => as(ask, 'gabriel_app', OPEN, [value, null, null])),
    ).rejects.toMatchObject({ code });
  });

  test(`append_chat_message refuses the text ${JSON.stringify(value)}`, async () => {
    await expect(
      rolledBack(async (ask) =>
        as(ask, 'gabriel_app', APPEND, [await opened(ask), 'user', value, null, '[]']),
      ),
    ).rejects.toMatchObject({ code });
  });
}
