// The named rules decide each unit in the database. Each case runs inside a transaction that rolls
// back, so the census tests count the same rows before and after. The test database is shared, so
// every case reads only the rows that it wrote.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import {
  as,
  cited,
  join,
  label,
  rate as worker,
  reference,
  type Cited,
  type Source,
} from './author-fixture.ts';
import { rolledBack, type Ask } from './probe.ts';

const EXTRACTOR = 'decide-by-rules-test@1';
const PAGE = 'The 57th Brigade is part of the 5th Army.';
const MANUAL = 'validated manually by the operator';

const id = z.array(z.object({ id: z.uuid() }));

const first = async (ask: Ask, text: string, values: readonly unknown[] = []): Promise<string> => {
  const [row] = id.parse(await ask(text, values));
  if (row === undefined) throw new Error('the statement returned no row');
  return row.id;
};

// An act of the extractor names the call of the model that made it.
const call = async (ask: Ask): Promise<string> =>
  as(ask, 'gabriel_agent', () =>
    first(
      ask,
      `SELECT public.record_model_call('extractor', 'v2', 'openrouter', 'a-model', $1, 120,
         'ok', NULL, 'a-model', 10, 5) AS id`,
      ['e'.repeat(64)],
    ),
  );

const document = async (ask: Ask): Promise<string> => {
  const doc = `doc_${randomUUID().slice(0, 8)}`;
  await ask(
    `SELECT public.put_document($1, 'file', $2, $3, NULL, NULL, NULL, 'text/plain',
       '2026-10-07'::date)`,
    [doc, `Source ${doc}`, `raw/${doc}.txt`],
  );
  await ask('SELECT public.put_document_text($1, $2::jsonb, $3)', [
    doc,
    JSON.stringify([PAGE]),
    EXTRACTOR,
  ]);
  return doc;
};

// An entity that the record holds, so that a relation between two of them is a unit of one act.
const held = async (ask: Ask, label: string): Promise<string> => {
  const act = await as(ask, 'gabriel_app', () =>
    first(
      ask,
      `SELECT public.propose_change('create_entity', $1::jsonb, ARRAY['manual']::text[]) AS id`,
      [JSON.stringify({ type: 'military_unit', label })],
    ),
  );
  return first(
    ask,
    `INSERT INTO public.entities (type, label, sources, promoted_from)
     VALUES ('military_unit', $1, ARRAY['manual']::doc_id[], $2) RETURNING id`,
    [label, act],
  );
};

interface Act {
  readonly role?: string;
  readonly author: string;
  readonly src: string;
  readonly dst: string;
  readonly dissent?: boolean;
}

// One act of a machine that links two elements, and the identifier it got.
const link = async (ask: Ask, act: Act): Promise<string> => {
  const doc = await document(ask);
  const item = randomUUID();
  const made = (act.role ?? 'gabriel_agent') === 'gabriel_agent' ? await call(ask) : null;
  await as(ask, act.role ?? 'gabriel_agent', () =>
    ask('SELECT item FROM public.propose_batch($1::jsonb)', [
      JSON.stringify([
        {
          id: item,
          op: 'create_relation',
          payload: { type: 'subordinate_to', src_id: act.src, dst_id: act.dst, sources: [doc] },
          src: [doc],
          names: [act.src, act.dst],
          model_call_id: made,
          originator: act.author,
          modality: 'asserts',
          ...(act.dissent === true ? { dissent: true, dissent_reason: 'two readings differ' } : {}),
          citations: [
            { document: doc, text_extractor: EXTRACTOR, page: 1, start: 0, end: PAGE.length },
          ],
        },
      ]),
    ]),
  );
  return item;
};

const decision = z.object({
  status: z.string(),
  decided_by: z.string().nullable(),
  decided_as: z.string().nullable(),
  decision_origin: z.string().nullable(),
  reject_reason: z.string().nullable(),
});

const stateOf = async (ask: Ask, act: string) => {
  const [row] = z.array(decision).parse(
    await ask(
      `SELECT status, decided_by, decided_as, decision_origin, reject_reason
         FROM public.proposals WHERE id = $1`,
      [act],
    ),
  );
  if (row === undefined) throw new Error('the record holds no such act');
  return row;
};

const ruleOf = async (ask: Ask, act: string): Promise<string | null> => {
  const [row] = z
    .array(z.object({ rule: z.string().nullable() }))
    .parse(
      await as(ask, 'gabriel_app', () =>
        ask('SELECT public.unit_rule(unit_id) AS rule FROM public.proposals WHERE id = $1', [act]),
      ),
    );
  return row?.rule ?? null;
};

const ends = async (ask: Ask) => ({
  child: await held(ask, `Child ${randomUUID()}`),
  parent: await held(ask, `Parent ${randomUUID()}`),
});

const name = () => `Author ${randomUUID()}`;

// The operator puts A and B into the reference set. The worker rates every other letter.
const rate = (ask: Ask, author: string, letter: string): Promise<unknown> =>
  letter === 'A' || letter === 'B' ? reference(ask, author, letter) : worker(ask, author, letter);

const check = (ask: Ask, one: Cited, verdict = 'supported'): Promise<unknown> =>
  as(ask, 'gabriel_agent', () =>
    ask('SELECT public.record_act_check($1::uuid, $2, $3, $4, $5)', [
      one.act,
      'a-checker',
      'openai',
      'anthropic',
      verdict,
    ]),
  );

// Two sources that differ in every way that the proof of independence reads.
const ONE: Partial<Source> = {
  uri: 'https://one.example/a',
  text: 'The fifty seventh brigade now holds the eastern bank of the river.',
};
const TWO: Partial<Source> = {
  uri: 'https://two.example/b',
  text: 'Satellite images show the unit near the town since early spring.',
};

// One act of the research AI that links two elements, with one citation of a document of its own.
// Acts with the same ends make one claim, and they are no twins, so each one is a unit.
const linked = async (
  ask: Ask,
  end: { readonly child: string; readonly parent: string },
  source: Partial<Source> & { readonly author: string },
): Promise<Cited> => {
  const doc = `doc_${randomUUID().slice(0, 8)}`;
  const text = source.text ?? PAGE;
  await ask(
    `SELECT public.put_document($1, 'file', $2, $3, $4, NULL, NULL, 'text/plain',
       '2026-10-07'::date)`,
    [doc, `Source ${doc}`, `raw/${doc}.txt`, source.uri ?? null],
  );
  await ask('SELECT public.put_document_text($1, $2::jsonb, $3)', [
    doc,
    JSON.stringify([text]),
    EXTRACTOR,
  ]);
  const item = {
    id: randomUUID(),
    op: 'create_relation',
    payload: { type: 'subordinate_to', src_id: end.child, dst_id: end.parent, sources: [doc] },
    src: [doc],
    names: [end.child, end.parent],
    model_call_id: null,
    originator: source.author,
    modality: source.modality ?? 'asserts',
    citations: [
      { document: doc, text_extractor: EXTRACTOR, page: 1, start: 0, end: Array.from(text).length },
    ],
  };
  const act = await as(ask, 'gabriel_research', () =>
    first(ask, 'SELECT proposal_id AS id FROM public.propose_batch($1::jsonb)', [
      JSON.stringify([item]),
    ]),
  );
  return { act, citation: '', claimKey: '' };
};

const STRONG = /^rule strong_sources v\d+ \(fact digits: [0-9, ]+\)$/u;

test('a fact with one source A is accepted when the check passes, with its origin and inputs', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const author = name();
    await rate(ask, author, 'A');
    const one = await cited(ask, { author, label: label(), ...ONE });
    const before = (await stateOf(ask, one.act)).status;
    await check(ask, one);
    return {
      before,
      state: await stateOf(ask, one.act),
      written: await ask('SELECT 1 FROM public.entities WHERE promoted_from = $1', [one.act]),
    };
  });
  expect(read.before).toBe('pending');
  expect(read.state).toMatchObject({
    status: 'accepted',
    decided_by: 'rule strong_sources v1',
    decided_as: 'rule',
  });
  expect(read.state.decision_origin).toBe('rule strong_sources v1 (fact digits: 3)');
  expect(read.written).toHaveLength(1);
});

test.each([
  ['a source A with no check', 'A', 'none'],
  ['a source A with a check of the same family', 'A', 'same'],
  ['a source A with an unclear check', 'A', 'unclear'],
  ['a source B with a passed check', 'B', 'supported'],
])('%s waits', async (_case, letter, verdict) => {
  const read = await rolledBack('superuser', async (ask) => {
    const author = name();
    await rate(ask, author, letter);
    const one = await cited(ask, { author, label: label(), ...ONE });
    if (verdict === 'same') {
      await as(ask, 'gabriel_agent', () =>
        ask(
          "SELECT public.record_act_check($1::uuid, 'm', 'anthropic', 'Anthropic', 'supported')",
          [one.act],
        ),
      );
    } else if (verdict !== 'none') {
      await check(ask, one, verdict);
    }
    return { state: await stateOf(ask, one.act), rule: await ruleOf(ask, one.act) };
  });
  expect(read.state.status).toBe('pending');
  expect(read.rule).toBe('weak_sources');
});

test('two independent citations, one B and one C, pass when the last check ends', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const [one, two] = [name(), name()];
    await rate(ask, one, 'B');
    await rate(ask, two, 'C');
    const end = await ends(ask);
    const early = await linked(ask, end, { author: one, ...ONE });
    const late = await linked(ask, end, { author: two, ...TWO });
    const before = (await stateOf(ask, early.act)).status;
    await check(ask, early);
    const half = (await stateOf(ask, early.act)).status;
    await check(ask, late);
    const after = await stateOf(ask, early.act);
    return { before, half, after };
  });
  expect(read.before).toBe('pending');
  expect(read.half).toBe('pending');
  expect(read.after.status).toBe('accepted');
  expect(read.after.decision_origin).toMatch(STRONG);
});

test.each([
  ['two citations with no proof of independence', 'B', 'B', 'https://one.example/other', false],
  ['two citations of two C authors', 'C', 'C', 'https://two.example/b', false],
  ['a citation B and a citation D', 'B', 'D', 'https://two.example/b', false],
  ['two citations of one author', 'B', 'B', 'https://two.example/b', true],
])('%s do not pass', async (_case, first_letter, second_letter, uri, same) => {
  const read = await rolledBack('superuser', async (ask) => {
    const [one, other] = [name(), name()];
    await rate(ask, one, first_letter);
    await rate(ask, other, second_letter);
    const end = await ends(ask);
    const early = await linked(ask, end, { author: one, ...ONE });
    const late = await linked(ask, end, { author: same ? one : other, ...TWO, uri });
    await check(ask, early);
    await check(ask, late);
    return stateOf(ask, early.act);
  });
  expect(read.status).toBe('pending');
});

test('a new letter makes a unit that waits go through the rules again', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const author = name();
    const one = await cited(ask, { author, label: label(), ...ONE });
    await check(ask, one);
    const before = (await stateOf(ask, one.act)).status;
    await rate(ask, author, 'A');
    return { before, after: await stateOf(ask, one.act) };
  });
  expect(read.before).toBe('pending');
  expect(read.after.decision_origin).toMatch(STRONG);
});

test('a name that joins a known author makes a unit that waits go through the rules again', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const [known, other, alias] = [name(), name(), name()];
    await rate(ask, known, 'B');
    await rate(ask, other, 'C');
    const end = await ends(ask);
    const early = await linked(ask, end, { author: known, ...ONE });
    const late = await linked(ask, end, { author: alias, ...TWO });
    await check(ask, early);
    await check(ask, late);
    const before = (await stateOf(ask, early.act)).status;
    await join(ask, alias, other);
    return { before, after: await stateOf(ask, early.act) };
  });
  expect(read.before).toBe('pending');
  expect(read.after.status).toBe('accepted');
});

test('a join into an author A or B goes to the operator', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const [known, alias] = [name(), name()];
    await rate(ask, known, 'A');
    const one = await cited(ask, { author: alias, label: label(), ...ONE });
    await check(ask, one);
    await join(ask, alias, known);
    return { state: await stateOf(ask, one.act), rule: await ruleOf(ask, one.act) };
  });
  expect(read.state.status).toBe('pending');
  expect(read.rule).toBe('doubt');
});

test('a unit with only sources D or E waits, and no rule rejects it', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const [weak, worse] = [name(), name()];
    await rate(ask, weak, 'D');
    await rate(ask, worse, 'E');
    const end = await ends(ask);
    const one = await linked(ask, end, { author: weak, ...ONE });
    const two = await linked(ask, end, { author: worse, ...TWO });
    await check(ask, one);
    await check(ask, two);
    return { state: await stateOf(ask, one.act), rule: await ruleOf(ask, one.act) };
  });
  expect(read.state.status).toBe('pending');
  expect(read.rule).toBe('weak_sources');
});

test('a check that disputes the fact goes to the operator even with a source A', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const author = name();
    await rate(ask, author, 'A');
    const one = await cited(ask, { author, label: label(), ...ONE });
    await check(ask, one, 'not_supported');
    return { state: await stateOf(ask, one.act), rule: await ruleOf(ask, one.act) };
  });
  expect(read.state.status).toBe('pending');
  expect(read.rule).toBe('doubt');
});

test('a denial by a party to the conflict goes to the operator, and one by an author F does not', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const [source, party] = [name(), name()];
    await worker(ask, source, 'C');
    await worker(ask, party, 'C', { controller: 'A State', party: true });
    const end = await ends(ask);
    const one = await linked(ask, end, { author: source, ...ONE });
    await linked(ask, end, { author: name(), modality: 'denies', ...TWO });
    const free = await ruleOf(ask, one.act);
    await linked(ask, end, {
      author: party,
      modality: 'denies',
      uri: 'https://three.example/c',
      text: 'The ministry says that this unit is not on that bank.',
    });
    return { free, party: await ruleOf(ask, one.act) };
  });
  expect(read.free).toBe('weak_sources');
  expect(read.party).toBe('doubt');
});

test('a link from an element to itself is rejected by the impossible rule, with its origin', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { child } = await ends(ask);
    const act = await link(ask, { author: name(), src: child, dst: child });
    return stateOf(ask, act);
  });
  expect(read).toMatchObject({
    status: 'rejected',
    decided_by: 'rule impossible v1',
    decided_as: 'rule',
  });
  expect(read.decision_origin).toMatch(/^rule impossible v1 \(fact digits: [0-9a-z, ]+\)$/u);
});

test('a link to an element that was rejected is rejected by the impossible rule', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { parent } = await ends(ask);
    const doc = await document(ask);
    const gone = randomUUID();
    const made = await call(ask);
    await as(ask, 'gabriel_agent', () =>
      ask('SELECT item FROM public.propose_batch($1::jsonb)', [
        JSON.stringify([
          {
            id: gone,
            op: 'create_entity',
            payload: { type: 'military_unit', label: `Gone ${gone}`, sources: [doc] },
            src: [doc],
            names: [],
            model_call_id: made,
            originator: name(),
            modality: 'asserts',
            citations: [
              { document: doc, text_extractor: EXTRACTOR, page: 1, start: 0, end: PAGE.length },
            ],
          },
        ]),
      ]),
    );
    await ask(
      `UPDATE public.proposals SET status = 'rejected', decided_at = now(), decided_by = 'a test',
         reject_reason = 'duplicate' WHERE id = $1`,
      [gone],
    );
    const act = await link(ask, { author: name(), src: gone, dst: parent });
    return stateOf(ask, act);
  });
  expect(read).toMatchObject({ status: 'rejected', reject_reason: 'end_rejected' });
  expect(read.decision_origin).toMatch(/^rule impossible v1/u);
});

test('a dispute goes to the operator even with a source A', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const author = name();
    await rate(ask, author, 'A');
    const one = await cited(ask, { author, label: label(), dissentReason: 'two readings', ...ONE });
    await check(ask, one);
    return { state: await stateOf(ask, one.act), rule: await ruleOf(ask, one.act) };
  });
  expect(read.state.status).toBe('pending');
  expect(read.rule).toBe('doubt');
});

test('a claim that the operator rejected before goes to the operator even with a source A', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const author = name();
    await rate(ask, author, 'A');
    const { child, parent } = await ends(ask);
    const old = await link(ask, { author: name(), src: child, dst: parent });
    await ask(
      `UPDATE public.proposals SET status = 'rejected', decided_at = now(), decided_by = 'a test',
         reject_reason = 'wrong_value' WHERE id = $1`,
      [old],
    );
    const act = await link(ask, { author, src: child, dst: parent });
    return { state: await stateOf(ask, act), rule: await ruleOf(ask, act) };
  });
  expect(read.state.status).toBe('pending');
  expect(read.rule).toBe('doubt');
});

test('the impossible rule comes before the doubt rule', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { child } = await ends(ask);
    const act = await link(ask, { author: name(), src: child, dst: child, dissent: true });
    return stateOf(ask, act);
  });
  expect(read.decision_origin).toMatch(/^rule impossible v1/u);
});

test('the threshold is a row of configuration, and the origin names the new version', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const [row] = z
      .array(z.object({ version: z.number(), settings: z.record(z.string(), z.string()) }))
      .parse(
        await ask(`SELECT version, settings FROM public.rule_config WHERE rule = 'strong_sources'`),
      );
    await ask(
      `UPDATE public.rule_config SET version = 2, settings = '{"single":"B","pair":"C","other":"D"}'
        WHERE rule = 'strong_sources'`,
    );
    const author = name();
    await rate(ask, author, 'B');
    const one = await cited(ask, { author, label: label(), ...ONE });
    await check(ask, one);
    return { start: row, state: await stateOf(ask, one.act) };
  });
  expect(read.start).toStrictEqual({
    version: 1,
    settings: { single: 'A', pair: 'B', other: 'C' },
  });
  expect(read.state.decided_by).toBe('rule strong_sources v2');
  expect(read.state.decision_origin).toMatch(/^rule strong_sources v2 /u);
});

test('a decision of the operator records that it was validated manually', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { child, parent } = await ends(ask);
    const accepted = await as(ask, 'gabriel_app', () =>
      first(
        ask,
        `SELECT proposal_id AS id FROM public.sign_change('the writer door', 'create_relation',
           $1::jsonb, ARRAY['manual']::text[], NULL, NULL, $2::uuid[])`,
        [
          JSON.stringify({ type: 'subordinate_to', src_id: child, dst_id: parent }),
          [child, parent],
        ],
      ),
    );
    const act = await link(ask, { author: name(), src: parent, dst: child });
    await ask(
      `UPDATE public.proposals SET status = 'rejected', decided_at = now(), decided_by = 'a test',
         reject_reason = 'duplicate' WHERE id = $1`,
      [act],
    );
    return [await stateOf(ask, accepted), await stateOf(ask, act)];
  });
  expect(read.map((row) => row.decision_origin)).toStrictEqual([MANUAL, MANUAL]);
});

test.each(['gabriel_agent', 'gabriel_research', 'gabriel_app', 'gabriel_read'])(
  'the role %s cannot call the function of the rules',
  async (role) => {
    const refused = async (text: string): Promise<string> => {
      try {
        await rolledBack('superuser', (ask) => as(ask, role, () => ask(text, [randomUUID()])));
      } catch (cause) {
        return cause instanceof Error ? cause.message : String(cause);
      }
      return 'allowed';
    };
    expect(await refused('SELECT public.apply_rules($1::uuid)')).toMatch(/permission denied/u);
    expect(await refused('SELECT public.run_rules(ARRAY[$1::uuid])')).toMatch(/permission denied/u);
  },
);
