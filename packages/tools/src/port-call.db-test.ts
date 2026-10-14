// Two dated calls of one vessel at one port are two facts. Each test runs inside a transaction
// that rolls back, so the corpus stays as it was.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { as } from '../../../tools/author-fixture.ts';
import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { proposeOf } from './propose.ts';
import { callTool, type Session } from './tool.ts';

const sessionOf = (ask: Ask): Session => ({
  query: async (text, values) => ({ rows: await ask(text, values) }),
});

const STORE = 'SELECT public.put_fetched_document($1, $2, $3, $4, $5, $6, $7::date, $8) AS id';
// The door of a fetched document accepts only today or yesterday.
const TODAY = new Date().toISOString().slice(0, 10);
const WRITE_TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3) AS pages';

// The research role stores a post and its text. The number makes the hash, and so the identifier.
const post = async (ask: Ask, number: number, text: string): Promise<string> => {
  const sha = number.toString(16).padStart(2, '0').repeat(32);
  const id = `doc_${sha.slice(0, 12)}`;
  await as(ask, 'gabriel_research', async () => {
    await ask(STORE, [
      'url',
      `A post ${String(number)}`,
      `raw/${sha}`,
      `https://shipping.example/${String(number)}`,
      sha,
      'text/html',
      TODAY,
      null,
    ]);
    await ask(WRITE_TEXT, [id, JSON.stringify([text]), 'port-call-test-1']);
  });
  return id;
};

const made = z.array(z.object({ id: z.uuid() }));

const INSERT_ENTITY = `INSERT INTO public.entities (type, label, sources, promoted_from)
  VALUES ($1, $2, ARRAY['manual']::doc_id[], $3) RETURNING id`;

// A vessel and a port of the record, so that each call names the same two fixed ends.
const endsOf = async (ask: Ask): Promise<{ vessel: string; port: string }> => {
  const entity = async (type: string, label: string): Promise<string> => {
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
    const [act] = made.parse(
      await ask(`SELECT public.propose_change($1, $2::jsonb, ARRAY['manual']::text[]) AS id`, [
        'create_entity',
        JSON.stringify({ type, label }),
      ]),
    );
    await ask('RESET SESSION AUTHORIZATION');
    const [row] = made.parse(await ask(INSERT_ENTITY, [type, label, act?.id]));
    if (row === undefined) throw new Error('no entity came back');
    return row.id;
  };
  return {
    vessel: await entity('vessel', `Nayara ${randomUUID()}`),
    port: await entity('port', `Sikka ${randomUUID()}`),
  };
};

const TEXT = 'The tanker Nayara loaded at Sikka on 19 May 2026 and again on 2 June 2026.';
const FIRST = 'loaded at Sikka on 19 May 2026';
const SECOND = 'again on 2 June 2026';

const callAct = (ends: { vessel: string; port: string }, day?: string) => ({
  op: 'create_relation',
  type: 'loads_at',
  srcId: ends.vessel,
  dstId: ends.port,
  ...(day === undefined ? {} : { attrs: { observed_on: { v: day } } }),
});

const item = (
  ref: string,
  act: Readonly<Record<string, unknown>>,
  document: string,
  excerpt: string,
  author: string,
  modality = 'asserts',
) => ({
  ref,
  act,
  originator: author,
  modality,
  evidence: [{ document, page: 1, excerpt }],
});

const proposed = async (ask: Ask, items: readonly unknown[]) =>
  as(ask, 'gabriel_research', () => callTool(proposeOf(null), sessionOf(ask), { items }));

const ids = z.object({ proposals: z.array(z.object({ ref: z.string(), proposalId: z.uuid() })) });

const idOf = async (ask: Ask, items: readonly unknown[], ref = 'call'): Promise<string> => {
  const outcome = await proposed(ask, items);
  if (!outcome.ok) throw new Error(`propose refused: ${outcome.refusal}`);
  const found = ids.parse(outcome.output).proposals.find((one) => one.ref === ref);
  if (found === undefined) throw new Error(`no proposal for ${ref}`);
  return found.proposalId;
};

const keyOf = async (ask: Ask, act: string): Promise<string> => {
  const [row] = z
    .array(z.object({ claim_key: z.string() }))
    .parse(await ask('SELECT claim_key FROM public.proposals WHERE id = $1', [act]));
  if (row === undefined) throw new Error('the record holds no such act');
  return row.claim_key;
};

const name = () => `Author ${randomUUID()}`;

test('two loads_at acts with two different days have two claim keys', async () => {
  const keys = await rolledBack('superuser', async (ask) => {
    const ends = await endsOf(ask);
    const doc = await post(ask, 21, TEXT);
    const first = await idOf(ask, [item('call', callAct(ends, '2026-05-19'), doc, FIRST, name())]);
    const second = await idOf(ask, [
      item('call', callAct(ends, '2026-06-02'), doc, SECOND, name()),
    ]);
    return [await keyOf(ask, first), await keyOf(ask, second)];
  });
  expect(keys[0]).not.toBe(keys[1]);
});
