// Two dated calls of one vessel at one port are two facts. Each test runs inside a transaction
// that rolls back, so the corpus stays as it was.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { as, OWN_SITE, rate, reference } from '../../../tools/author-fixture.ts';
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

const check = (ask: Ask, act: string): Promise<unknown> =>
  as(ask, 'gabriel_checker', () =>
    ask('SELECT public.record_research_check($1::uuid, $2, $3, $4, $5)', [
      act,
      'a-checker',
      'openai',
      'anthropic',
      'supported',
    ]),
  );

const stateOf = async (ask: Ask, act: string) => {
  const [row] = z
    .array(z.object({ status: z.string(), rule: z.string().nullable(), dissent: z.boolean() }))
    .parse(
      await ask(
        `SELECT status, public.unit_rule(unit_id) AS rule, dissent
           FROM public.proposals WHERE id = $1`,
        [act],
      ),
    );
  if (row === undefined) throw new Error('the record holds no such act');
  return row;
};

const unitOf = async (ask: Ask, act: string): Promise<string> => {
  const [row] = z
    .array(z.object({ unit_id: z.uuid() }))
    .parse(await ask('SELECT unit_id FROM public.proposals WHERE id = $1', [act]));
  if (row === undefined) throw new Error('the record holds no such act');
  return row.unit_id;
};

const faultKinds = async (ask: Ask, acts: readonly string[]): Promise<string[][]> => {
  const units = await Promise.all(acts.map((act) => unitOf(ask, act)));
  const rows = z
    .array(z.object({ unit_id: z.uuid(), faults: z.array(z.object({ kind: z.string() })) }))
    .parse(await ask('SELECT unit_id, faults FROM public.unit_faults($1::uuid[])', [units]));
  return units.map(
    (unit) => rows.find((row) => row.unit_id === unit)?.faults.map((one) => one.kind) ?? [],
  );
};

test('a rejection of one dated call does not reject the other', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const ends = await endsOf(ask);
    const doc = await post(ask, 22, TEXT);
    const first = await idOf(ask, [item('call', callAct(ends, '2026-05-19'), doc, FIRST, name())]);
    await ask("SELECT public.reject_unit($1::uuid, 'wrong_value', NULL, 'a test')", [
      await unitOf(ask, first),
    ]);
    const again = await idOf(ask, [item('call', callAct(ends, '2026-05-19'), doc, FIRST, name())]);
    const other = await idOf(ask, [item('call', callAct(ends, '2026-06-02'), doc, SECOND, name())]);
    return faultKinds(ask, [again, other]);
  });
  expect(read[0]).toContain('rejected_before');
  expect(read[1]).not.toContain('rejected_before');
});

const DENIAL = 'did not load at Sikka on 19 May 2026';

test('a denial of one dated call does not deny the other', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const [claimant, party] = [name(), name()];
    await reference(ask, claimant, 'B');
    await reference(ask, party, 'A', { ...OWN_SITE, party: true, controller: 'A State' });
    const doc = await post(ask, 23, TEXT);
    const ends = await endsOf(ask);
    const first = await idOf(ask, [
      item('call', callAct(ends, '2026-05-19'), doc, FIRST, claimant),
    ]);
    const second = await idOf(ask, [
      item('call', callAct(ends, '2026-06-02'), doc, SECOND, claimant),
    ]);
    await check(ask, first);
    await check(ask, second);
    const denial = await post(ask, 24, `The owner says the tanker ${DENIAL}.`);
    await idOf(ask, [item('call', callAct(ends, '2026-05-19'), denial, DENIAL, party, 'denies')]);
    return { first: await stateOf(ask, first), second: await stateOf(ask, second) };
  });
  expect(read.first.rule).toBe('doubt');
  expect(read.second.rule).not.toBe('doubt');
});

const supportOf = async (ask: Ask, key: string): Promise<number> =>
  z
    .array(z.object({ act: z.uuid() }))
    .parse(await ask('SELECT act FROM public.fact_support($1)', [key])).length;

const digitOf = async (ask: Ask, key: string): Promise<number> => {
  const [row] = z
    .array(z.object({ digit: z.number() }))
    .parse(await ask('SELECT public.fact_digit($1)::int AS digit', [key]));
  if (row === undefined) throw new Error('no digit came back');
  return row.digit;
};

test('the digit of each dated call counts only its own sources', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const [one, two] = [name(), name()];
    await rate(ask, one, 'C');
    await rate(ask, two, 'C');
    const ends = await endsOf(ask);
    const first = await post(ask, 25, TEXT);
    const second = await post(ask, 26, `Another report: ${TEXT}`);
    const acts = [
      await idOf(ask, [item('call', callAct(ends, '2026-05-19'), first, FIRST, one)]),
      await idOf(ask, [item('call', callAct(ends, '2026-05-19'), second, FIRST, two)]),
      await idOf(ask, [item('call', callAct(ends, '2026-06-02'), first, SECOND, one)]),
    ];
    for (const act of acts) await check(ask, act);
    const [dayOne, dayTwo] = [await keyOf(ask, acts[0] ?? ''), await keyOf(ask, acts[2] ?? '')];
    return {
      supports: [await supportOf(ask, dayOne), await supportOf(ask, dayTwo)],
      digits: [await digitOf(ask, dayOne), await digitOf(ask, dayTwo)],
    };
  });
  expect(read.supports).toStrictEqual([2, 1]);
  expect(read.digits[0]).not.toBe(read.digits[1]);
});

// The key of a relation as 0056 builds it: the type and the two ends, and no day.
const OLD_KEY = `md5(jsonb_build_array('create_relation', $1::text,
  public.claim_end_key($2::text), public.claim_end_key($3::text))::text)`;

const keyWith = async (
  ask: Ask,
  type: string,
  ends: { vessel: string; port: string },
  attrs: object,
) => {
  const [row] = z.array(z.object({ key: z.string(), old: z.string() })).parse(
    await ask(
      `SELECT public.claim_key_of('create_relation', NULL, NULL,
                jsonb_build_object('type', $1::text, 'src_id', $2::text, 'dst_id', $3::text,
                                   'attrs', $4::jsonb)) AS key,
              ${OLD_KEY} AS old`,
      [type, ends.vessel, ends.port, JSON.stringify(attrs)],
    ),
  );
  if (row === undefined) throw new Error('no key came back');
  return row;
};

test('a port call with no day keeps its old key, and the day enters no other type', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const ends = await endsOf(ask);
    const doc = await post(ask, 27, TEXT);
    const act = await idOf(ask, [item('call', callAct(ends), doc, FIRST, name())]);
    const day = { observed_on: { v: '2026-05-19' } };
    return {
      stored: await keyOf(ask, act),
      undated: await keyWith(ask, 'loads_at', ends, {}),
      dated: await keyWith(ask, 'loads_at', ends, day),
      owns: [await keyWith(ask, 'owns', ends, {}), await keyWith(ask, 'owns', ends, day)],
      flagged: [
        await keyWith(ask, 'flagged_falsely', ends, {}),
        await keyWith(ask, 'flagged_falsely', ends, day),
      ],
    };
  });
  expect(read.stored).toBe(read.undated.old);
  expect(read.undated.key).toBe(read.undated.old);
  expect(read.dated.key).not.toBe(read.dated.old);
  expect(read.owns[1]?.key).toBe(read.owns[0]?.key);
  expect(read.flagged[1]?.key).toBe(read.flagged[0]?.key);
});
