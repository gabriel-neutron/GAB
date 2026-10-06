// Code sets the adverse predicate from the approved list, for each named person and company of a
// claim. A reader can set it and no role can clear it. Each gesture runs inside a transaction that
// rolls back, so the census tests count the same rows.

import { expect, test } from 'vitest';
import { z } from 'zod';

import {
  anEntity,
  aPair,
  asRole,
  idOf,
  runChecks,
  sourcedPayload,
  spanOf,
} from './evidence-fixture.ts';
import { rolledBack, type Ask } from './probe.ts';

interface Rule {
  readonly row_kind: 'keyword' | 'key';
  readonly subject_kind: string;
  readonly predicate: string;
  readonly class: string;
  readonly lang?: string;
  readonly keyword?: string;
  readonly key?: string;
}

const RULES: readonly Rule[] = [
  {
    row_kind: 'key',
    subject_kind: 'vessel',
    predicate: 'belligerent_listing',
    class: 'official_act',
    key: 'gur_listed',
  },
  {
    row_kind: 'keyword',
    subject_kind: 'unit',
    predicate: 'war_crime',
    class: 'adverse_allegation',
    lang: 'eng',
    keyword: 'shelled',
  },
  {
    row_kind: 'keyword',
    subject_kind: 'company',
    predicate: 'sanctions_evasion',
    class: 'adverse_allegation',
    lang: 'eng',
    keyword: 'evaded sanctions',
  },
];

const LOAD = 'SELECT public.load_adverse_predicates($1, $2::jsonb)::text AS id';

const load = (ask: Ask, rules: readonly Rule[] = RULES): Promise<string> =>
  asRole(ask, 'gabriel_app', () => idOf(ask, LOAD, ['fixture.csv', JSON.stringify(rules)]));

const predicates = z.array(
  z.object({
    party_label: z.string(),
    party_kind: z.string(),
    predicate: z.string(),
    class: z.string(),
    set_by: z.string(),
  }),
);

const READ = `SELECT party_label, party_kind, predicate, class, set_by
  FROM public.adverse_predicate WHERE claim_id = $1 ORDER BY party_label, predicate`;

test('a GUR tanker entry that names an owner and a manager gives the predicate to both, with its class', async () => {
  const page =
    'The tanker Nayara Star, owned by Sikka Shipping and managed by Volga Management, is on the list.';
  const found = await rolledBack('superuser', async (ask) => {
    await load(ask);
    const pair = await aPair(ask, {
      document: 'doc_adverse_gur',
      page,
      payload: { type: 'vessel', label: 'Nayara Star', attrs: { gur_listed: true } },
      span: spanOf(page, page),
      before: async (inner, document) => {
        await anEntity(inner, document, 'company', 'Sikka Shipping');
        await anEntity(inner, document, 'company', 'Volga Management');
      },
    });
    await runChecks(ask, pair.evidence, pair.claim);
    return predicates.parse(await ask(READ, [pair.claim]));
  });
  expect(found).toStrictEqual([
    {
      party_label: 'Sikka Shipping',
      party_kind: 'company',
      predicate: 'belligerent_listing',
      class: 'official_act',
      set_by: 'code',
    },
    {
      party_label: 'Volga Management',
      party_kind: 'company',
      predicate: 'belligerent_listing',
      class: 'official_act',
      set_by: 'code',
    },
  ]);
});

test('a unit claim that names a commander gives the predicate to the commander', async () => {
  const page = 'The 47th Tank Division, commanded by Ivan Petrov, shelled Sikka.';
  const found = await rolledBack('superuser', async (ask) => {
    await load(ask);
    const pair = await aPair(ask, {
      document: 'doc_adverse_unit',
      page,
      payload: { type: 'military_unit', label: '47th Tank Division', attrs: { location: 'Sikka' } },
      span: spanOf(page, page),
      before: async (inner, document) => {
        await anEntity(inner, document, 'person', 'Ivan Petrov');
      },
    });
    await runChecks(ask, pair.evidence, pair.claim);
    return predicates.parse(await ask(READ, [pair.claim]));
  });
  expect(found).toStrictEqual([
    {
      party_label: 'Ivan Petrov',
      party_kind: 'person',
      predicate: 'war_crime',
      class: 'adverse_allegation',
      set_by: 'code',
    },
  ]);
});

test('a claim of the own analysis that imputes an act to a named company gets the predicate', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    await load(ask);
    await ask(
      `SELECT public.put_document('doc_adverse_own', 'report', 'An analysis', 'raw/own', NULL, NULL,
         NULL, 'text/plain', '2026-05-04'::date)`,
    );
    const claim = await asRole(ask, 'gabriel_app', () =>
      idOf(
        ask,
        `SELECT public.propose_change('create_entity', $1::jsonb, ARRAY['doc_adverse_own']) AS id`,
        [
          JSON.stringify(
            sourcedPayload(
              {
                type: 'company',
                label: 'Volga Management',
                attrs: { note: 'It evaded sanctions through Sikka.' },
              },
              ['doc_adverse_own'],
            ),
          ),
        ],
      ),
    );
    await asRole(ask, 'gabriel_app', () =>
      ask('SELECT public.mark_adverse_predicates($1::uuid)', [claim]),
    );
    return predicates.parse(await ask(READ, [claim]));
  });
  expect(found).toStrictEqual([
    {
      party_label: 'Volga Management',
      party_kind: 'company',
      predicate: 'sanctions_evasion',
      class: 'adverse_allegation',
      set_by: 'code',
    },
  ]);
});

test('a reader that sets adverse gives the predicate of a reader to each party that code finds in the span', async () => {
  const page = 'The tanker Nayara Star was sold by Sikka Shipping.';
  const found = await rolledBack('superuser', async (ask) => {
    const pair = await aPair(ask, {
      document: 'doc_adverse_reader',
      page,
      payload: { type: 'vessel', label: 'Nayara Star' },
      span: spanOf(page, page),
      adverse: true,
      before: async (inner, document) => {
        await anEntity(inner, document, 'company', 'Sikka Shipping');
      },
    });
    await runChecks(ask, pair.evidence, pair.claim);
    return predicates.parse(await ask(READ, [pair.claim]));
  });
  expect(found).toStrictEqual([
    {
      party_label: 'Sikka Shipping',
      party_kind: 'company',
      predicate: 'reader_adverse',
      class: 'adverse_allegation',
      set_by: 'reader',
    },
  ]);
});

test('no role clears a predicate: the owner is refused by the trigger, and the model role holds no grant', async () => {
  const page = 'The tanker Nayara Star was sold by Sikka Shipping.';
  const seeded = (ask: Ask) =>
    aPair(ask, {
      document: 'doc_adverse_clear',
      page,
      payload: { type: 'vessel', label: 'Nayara Star' },
      span: spanOf(page, page),
      adverse: true,
      before: async (inner, document) => {
        await anEntity(inner, document, 'company', 'Sikka Shipping');
      },
    }).then(async (pair) => {
      await runChecks(ask, pair.evidence, pair.claim);
      return pair;
    });
  await expect(
    rolledBack('superuser', async (ask) => {
      const pair = await seeded(ask);
      return ask('DELETE FROM public.adverse_predicate WHERE claim_id = $1', [pair.claim]);
    }),
  ).rejects.toThrow(/never deleted/u);
  await expect(
    rolledBack('superuser', async (ask) => {
      const pair = await seeded(ask);
      return ask("UPDATE public.adverse_predicate SET predicate = 'fraud' WHERE claim_id = $1", [
        pair.claim,
      ]);
    }),
  ).rejects.toThrow(/never updated/u);
  await expect(
    rolledBack('agent', (ask) => ask('DELETE FROM public.adverse_predicate')),
  ).rejects.toMatchObject({ code: '42501' });
});

// ---------------------------------------------------------------------------- the loader ---

test('the loader refuses a predicate outside the closed list of its subject kind', async () => {
  await expect(
    rolledBack('superuser', (ask) =>
      load(ask, [
        {
          row_kind: 'keyword',
          subject_kind: 'vessel',
          predicate: 'fraud',
          class: 'adverse_allegation',
          lang: 'eng',
          keyword: 'fraud',
        },
      ]),
    ),
  ).rejects.toMatchObject({ code: '23514', constraint: 'adverse_predicate_rule_closed_list' });
});

test('a rule of an earlier load is never changed or deleted', async () => {
  for (const write of [
    "UPDATE public.adverse_predicate_rule SET predicate = 'shadow_fleet' WHERE load_id = $1",
    'DELETE FROM public.adverse_predicate_rule WHERE load_id = $1',
  ])
    await expect(
      rolledBack('superuser', async (ask) => ask(write, [await load(ask)])),
    ).rejects.toThrow(/never (updated|deleted)/u);
});

test('code reads the last load, and a fixture claim with gur_listed gets the predicate of its row', async () => {
  const page = 'The tanker Nayara Star, owned by Sikka Shipping, is on the list.';
  const last = await rolledBack('superuser', async (ask) => {
    await load(ask);
    await load(ask, [{ ...RULES[0], predicate: 'shadow_fleet' } as Rule]);
    const pair = await aPair(ask, {
      document: 'doc_adverse_last',
      page,
      payload: { type: 'vessel', label: 'Nayara Star', attrs: { gur_listed: true } },
      span: spanOf(page, page),
      before: async (inner, document) => {
        await anEntity(inner, document, 'company', 'Sikka Shipping');
      },
    });
    await runChecks(ask, pair.evidence, pair.claim);
    return predicates.parse(await ask(READ, [pair.claim])).map((row) => row.predicate);
  });
  expect(last).toStrictEqual(['shadow_fleet']);
});

test('gabriel_agent cannot run the loader, record a probe or mark a predicate', async () => {
  for (const call of [
    "SELECT public.load_adverse_predicates('x.csv', '[]'::jsonb)",
    "SELECT public.record_family_probe('p', 'a', 'b', 1, 0)",
    'SELECT public.mark_adverse_predicates(gen_random_uuid())',
  ])
    await expect(rolledBack('agent', (ask) => ask(call))).rejects.toMatchObject({ code: '42501' });
});

// ---------------------------------------------------------------------------- the grants ---

const WRITES = [
  'INSERT INTO public.citation_check (citation_id) VALUES (gen_random_uuid())',
  'UPDATE public.citation_check SET counts = true',
  "INSERT INTO public.family_probe_run (prompt_set_version) VALUES ('p')",
  "INSERT INTO public.parameter (key, value) VALUES ('name_match.min_ratio', 0.1)",
  "UPDATE public.parameter SET value = 1 WHERE key = 'family_probe.match_threshold'",
  'INSERT INTO public.adverse_predicate (claim_id) VALUES (gen_random_uuid())',
  'DELETE FROM public.adverse_predicate',
  'INSERT INTO public.adverse_predicate_rule (load_id) VALUES (gen_random_uuid())',
  'INSERT INTO public.citation (claim_id) VALUES (gen_random_uuid())',
  'INSERT INTO public.evidence_word (version) VALUES (9)',
] as const;

for (const write of WRITES)
  test(`a model role cannot write a check result or a list: ${write.slice(0, 40)}`, async () => {
    await expect(rolledBack('agent', (ask) => ask(write))).rejects.toMatchObject({
      code: '42501',
    });
  });
