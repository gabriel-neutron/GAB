// The originator is the one thing that a letter rates. These tests drive the letter, the flags and
// the doors through the database, and each one runs inside a transaction that rolls back. A
// fixture row is written as the superuser: only the doors are the gesture under test.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const run = <T>(work: (ask: Ask) => Promise<T>): Promise<T> => rolledBack('superuser', work);

const HASH = 'a'.repeat(64);
const AS_OF = '2030-01-01T00:00:00Z';

const letterRow = z.array(z.object({ letter: z.string(), letter_origin: z.string() }));
const one = <T extends z.ZodType>(shape: T) => z.array(shape).length(1);

const first = <T>(rows: readonly T[]): T => {
  const [row] = rows;
  if (row === undefined) throw new Error('the query returned no row');
  return row;
};

const ensure = async (
  ask: Ask,
  id: string,
  name = id,
  kind = 'account',
  jurisdiction: string | null = null,
  role: string | null = null,
): Promise<void> => {
  await ask('SELECT public.ensure_originator($1, $2, $3, $4, $5)', [
    id,
    name,
    kind,
    jurisdiction,
    role,
  ]);
};

const letterOf = async (ask: Ask, id: string, asOf = AS_OF): Promise<string> => {
  const [row] = letterRow.parse(
    await ask('SELECT letter, letter_origin FROM public.compute_originator_letter($1, $2)', [
      id,
      asOf,
    ]),
  );
  return row === undefined ? 'none' : `${row.letter}/${row.letter_origin}`;
};

const storedLetter = async (ask: Ask, id: string): Promise<string> => {
  const [row] = letterRow.parse(
    await ask('SELECT letter, letter_origin FROM public.originator WHERE id = $1', [id]),
  );
  return row === undefined ? 'none' : `${row.letter}/${row.letter_origin}`;
};

const refresh = async (ask: Ask, id: string, asOf = AS_OF): Promise<void> => {
  await ask('SELECT public.refresh_originator($1, $2)', [id, asOf]);
};

const settler = async (ask: Ask): Promise<void> => {
  await ask(
    `INSERT INTO public.documents (id, kind, title, uri, retrieved_at)
     VALUES ('doc_settle', 'url', 'an issuer record', 'https://ofac.example/record', current_date)`,
  );
};

// One resolved claim for each claim document, so n documents make n clusters. The first
// `trueCount` are true and the rest are false.
const clusters = async (
  ask: Ask,
  id: string,
  total: number,
  trueCount = total,
  tag = id.replace(/\W/g, ''),
): Promise<void> => {
  await ask(
    `INSERT INTO public.documents (id, kind, title, uri, retrieved_at)
     SELECT $1 || g, 'url', 'a claim page', 'https://example.org/' || $1 || g, current_date
       FROM generate_series(1, $2::int) AS g
     ON CONFLICT DO NOTHING`,
    [`doc_${tag}_`, total],
  );
  await ask(
    `INSERT INTO public.originator_resolution
       (originator_id, claim_id, claim_document, position, outcome, settled_by,
        settling_document, settling_captured_at, claim_document_date, resolved_at)
     SELECT $1, gen_random_uuid(), $2 || g, 'first',
            CASE WHEN g <= $3::int THEN 'true' ELSE 'false' END,
            'issuer_record', 'doc_settle', '2026-02-01T00:00:00Z', '2026-01-01',
            clock_timestamp()
       FROM generate_series(1, $4::int) AS g`,
    [id, `doc_${tag}_`, trueCount, total],
  );
};

// A measured letter that the history holds, `days` before the as-of day.
const aged = async (ask: Ask, id: string, letter: string, days: number): Promise<void> => {
  await ask(
    `INSERT INTO public.originator_letter_history
       (originator_id, letter, letter_origin, reason, changed_at)
     VALUES ($1, $2, 'track_record', '{}'::jsonb, $3::timestamptz - make_interval(days => $4::int))`,
    [id, letter, AS_OF, days],
  );
};

const card = async (
  ask: Ask,
  issuer: string,
  hosts: readonly string[],
  regime: string | null = null,
  patterns: readonly string[] = [],
): Promise<void> => {
  await ask(
    `INSERT INTO public.issuer_card
       (issuer_id, hosts, url_patterns, sanctions_regime, approved_sha256, approved_on,
        approval_reason, source_file)
     VALUES ($1, $2::text[], $3::text[], $4, $5, '2026-03-01', 'a test card', 'register-cards/t.yaml')`,
    [issuer, [...hosts], [...patterns], regime, HASH],
  );
};

const belligerents = async (ask: Ask): Promise<void> => {
  await ask(
    `INSERT INTO public.belligerent (code, name, conflict, approved_sha256, approved_on)
     VALUES ('RU', 'Russia', 'the war', $1, '2026-03-01'),
            ('UA', 'Ukraine', 'the war', $1, '2026-03-01')`,
    [HASH],
  );
};

const setParameter = async (ask: Ask, key: string, value: number | null): Promise<void> => {
  if (value === null) await ask('DELETE FROM public.parameter WHERE key = $1', [key]);
  else
    await ask(
      `INSERT INTO public.parameter (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value],
    );
};

const flagsOf = async (ask: Ask, id: string) =>
  first(
    one(
      z.object({
        party: z.string(),
        contested: z.boolean(),
        sanctioned_controlled: z.boolean(),
        imprint_id: z.string().nullable(),
        name_collides_with: z.string().nullable(),
        merged_into: z.string().nullable(),
      }),
    ).parse(
      await ask(
        `SELECT party, contested, sanctioned_controlled, imprint_id, name_collides_with, merged_into
         FROM public.originator WHERE id = $1`,
        [id],
      ),
    ),
  );

const historyOf = async (ask: Ask, id: string) =>
  z.array(z.object({ letter: z.string(), gate_rerun_at: z.date().nullable() })).parse(
    await ask(
      `SELECT letter, gate_rerun_at FROM public.originator_letter_history
          WHERE originator_id = $1 ORDER BY changed_at, letter`,
      [id],
    ),
  );

const statusOf = async (ask: Ask, door: string, ...values: readonly unknown[]): Promise<string> =>
  z
    .array(z.object({ found: z.string().nullable() }))
    .parse(
      await ask(
        `SELECT ${door}(${values.map((_, i) => `$${i + 1}`).join(', ')})::text AS found`,
        values,
      ),
    )[0]?.found ?? 'null';

// ----------------------------------------------------------------------- the id and the door ---

test('a new originator has letter F, party unknown and no flag', async () => {
  const held = await run(async (ask) => {
    await ensure(ask, 'telegram:1234567890', 'A channel');
    return {
      stored: await storedLetter(ask, 'telegram:1234567890'),
      flags: await flagsOf(ask, 'telegram:1234567890'),
    };
  });
  expect(held.stored).toBe('F/track_record');
  expect(held.flags).toMatchObject({ party: 'unknown', contested: false });
});

test('a second call with the same values writes nothing', async () => {
  const touched = await run(async (ask) => {
    await ensure(ask, 'host:tass.com', 'TASS', 'organisation', 'RU');
    const first = await ask(
      `SELECT xmin::text AS x FROM public.originator WHERE id = 'host:tass.com'`,
    );
    await ensure(ask, 'host:tass.com', 'TASS', 'organisation', 'RU');
    const second = await ask(
      `SELECT xmin::text AS x FROM public.originator WHERE id = 'host:tass.com'`,
    );
    return { first, second };
  });
  expect(touched.second).toStrictEqual(touched.first);
});

test('the door fills a NULL jurisdiction and role and never changes a value that is set', async () => {
  const held = await run(async (ask) => {
    await ensure(ask, 'host:icij.example', 'ICIJ', 'organisation');
    await ensure(ask, 'host:icij.example', 'ICIJ', 'organisation', 'US', 'holder');
    await ensure(ask, 'host:icij.example', 'ICIJ', 'organisation', 'RU', 'relay');
    return one(z.object({ jurisdiction: z.string(), role: z.string() })).parse(
      await ask(`SELECT jurisdiction, role FROM public.originator WHERE id = 'host:icij.example'`),
    )[0];
  });
  expect(held).toStrictEqual({ jurisdiction: 'US', role: 'holder' });
});

test('the door refuses the role issuer', async () => {
  await expect(
    run((ask) => ensure(ask, 'host:ofac.treasury.gov', 'OFAC', 'organisation', 'US', 'issuer')),
  ).rejects.toThrow(/issuer/);
});

test('the door refuses own_algorithm on a host id and a gab id of another kind', async () => {
  await expect(
    run((ask) => ensure(ask, 'host:algo.example', 'Algo', 'own_algorithm')),
  ).rejects.toThrow(/own_algorithm|algorithm/);
  await expect(
    run((ask) => ensure(ask, 'gab:geolocation-check:v1', 'Check', 'organisation')),
  ).rejects.toThrow(/own_algorithm|algorithm/);
  await run((ask) =>
    ensure(ask, 'gab:geolocation-check:v1', 'Check', 'own_algorithm', null, 'own_algorithm'),
  );
});

const REFUSED_IDS = [
  'Reuters',
  'reuters.com',
  'host:www.reuters.com',
  'host:Reuters.com',
  'host:reuters.com/path',
  'telegram:abc',
  'unknown:123',
  'host:',
];

for (const id of REFUSED_IDS)
  test(`the id "${id}" is refused as a canonical id`, async () => {
    await expect(run((ask) => ensure(ask, id, 'A name'))).rejects.toThrow();
  });

const CARRIERS = [
  'substack.com',
  't.me',
  'vk.com',
  'x.com',
  'archive.today',
  'tgstat.ru',
  'sanctions.lursoft.lv',
  'audit-it.ru',
];

for (const carrier of CARRIERS)
  test(`the carrier ${carrier} is never an originator`, async () => {
    await expect(
      run((ask) => ensure(ask, `host:${carrier}`, 'A carrier', 'organisation')),
    ).rejects.toThrow();
  });

test('a column of the originator and the card holds no digit, expiry date or score', async () => {
  const columns = await run(async (ask) =>
    z
      .array(z.object({ table_name: z.string(), column_name: z.string(), data_type: z.string() }))
      .parse(
        await ask(
          `SELECT table_name, column_name, data_type FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name IN ('originator', 'issuer_card')`,
        ),
      ),
  );
  expect(columns.length).toBeGreaterThan(10);
  for (const column of columns) {
    expect(column.column_name, `${column.table_name}.${column.column_name}`).not.toMatch(
      /digit|expir|score|valid_until|checked_until/,
    );
    expect(
      ['integer', 'smallint', 'bigint', 'numeric', 'real', 'double precision'],
      `${column.table_name}.${column.column_name}`,
    ).not.toContain(column.data_type);
  }
});

// ---------------------------------------------------------------------------- the bands -------

const BANDS: readonly { name: string; total: number; trues: number; expected: string }[] = [
  { name: '21 of 21 gives C', total: 21, trues: 21, expected: 'C/track_record' },
  { name: '8 of 8 gives C', total: 8, trues: 8, expected: 'C/track_record' },
  { name: '7 of 7 gives D', total: 7, trues: 7, expected: 'D/track_record' },
  { name: '5 of 5 gives D', total: 5, trues: 5, expected: 'D/track_record' },
  { name: '0 of 6 gives E', total: 6, trues: 0, expected: 'E/track_record' },
  { name: '0 of 5 gives F', total: 5, trues: 0, expected: 'F/track_record' },
  { name: '4 of 4 gives F', total: 4, trues: 4, expected: 'F/track_record' },
];

for (const band of BANDS)
  test(`band: ${band.name}`, async () => {
    const found = await run(async (ask) => {
      await settler(ask);
      await ensure(ask, 'substack:band');
      await clusters(ask, 'substack:band', band.total, band.trues);
      return letterOf(ask, 'substack:band');
    });
    expect(found).toBe(band.expected);
  });

test('band: 22 of 22 gives B once an earlier measured letter is 90 days old', async () => {
  const found = await run(async (ask) => {
    await settler(ask);
    await ensure(ask, 'substack:band');
    await clusters(ask, 'substack:band', 22);
    await aged(ask, 'substack:band', 'C', 100);
    return letterOf(ask, 'substack:band');
  });
  expect(found).toBe('B/track_record');
});

test('band: 75 of 75 gives A once an earlier measured letter is 90 days old', async () => {
  const found = await run(async (ask) => {
    await settler(ask);
    await ensure(ask, 'substack:band');
    await clusters(ask, 'substack:band', 75);
    await aged(ask, 'substack:band', 'B', 100);
    return letterOf(ask, 'substack:band');
  });
  expect(found).toBe('A/track_record');
});

test('the first measured letter is capped at C, also for 22 of 22 and 75 of 75', async () => {
  const found = await run(async (ask) => {
    await settler(ask);
    await ensure(ask, 'substack:band');
    await clusters(ask, 'substack:band', 22);
    await ensure(ask, 'substack:big');
    await clusters(ask, 'substack:big', 75);
    return [await letterOf(ask, 'substack:band'), await letterOf(ask, 'substack:big')];
  });
  expect(found).toStrictEqual(['C/track_record', 'C/track_record']);
});

test('with the cap row removed, 22 distinct clusters from F give B', async () => {
  const found = await run(async (ask) => {
    await settler(ask);
    await setParameter(ask, 'letter_first_cap_c', null);
    await ensure(ask, 'substack:band');
    await clusters(ask, 'substack:band', 22);
    return letterOf(ask, 'substack:band');
  });
  expect(found).toBe('B/track_record');
});

test('the seed holds the cap row and the ten band rows', async () => {
  const keys = await run(async (ask) =>
    z
      .array(z.object({ key: z.string() }))
      .parse(await ask(`SELECT key FROM public.parameter WHERE key LIKE 'letter\\_%' ORDER BY 1`)),
  );
  expect(keys.map((row) => row.key)).toStrictEqual([
    'letter_a_min_resolved',
    'letter_b_wilson_lower',
    'letter_c_wilson_lower',
    'letter_d_min_resolved',
    'letter_d_wilson_lower',
    'letter_e_min_resolved',
    'letter_e_wilson_upper',
    'letter_first_cap_c',
    'letter_step_days',
    'letter_wilson_z',
  ]);
});

test('22 true claims on one document are one cluster and give no B', async () => {
  const found = await run(async (ask) => {
    await settler(ask);
    await ensure(ask, 'substack:one');
    await ask(
      `INSERT INTO public.documents (id, kind, title, uri, retrieved_at)
       VALUES ('doc_one', 'url', 'one page', 'https://example.org/one', current_date)`,
    );
    await ask(
      `INSERT INTO public.originator_resolution
         (originator_id, claim_id, claim_document, position, outcome, settled_by,
          settling_document, settling_captured_at, claim_document_date)
       SELECT 'substack:one', gen_random_uuid(), 'doc_one', 'first', 'true', 'issuer_record',
              'doc_settle', '2026-02-01T00:00:00Z', '2026-01-01'
         FROM generate_series(1, 22)`,
    );
    await aged(ask, 'substack:one', 'C', 200);
    return letterOf(ask, 'substack:one');
  });
  expect(found).toBe('F/track_record');
});

test('a cluster with one false row counts as false', async () => {
  const found = await run(async (ask) => {
    await settler(ask);
    await ensure(ask, 'substack:mixed');
    await clusters(ask, 'substack:mixed', 8);
    await ask(
      `INSERT INTO public.originator_resolution
         (originator_id, claim_id, claim_document, position, outcome, settled_by,
          settling_document, settling_captured_at, claim_document_date)
       VALUES ('substack:mixed', gen_random_uuid(), 'doc_substackmixed_1', 'first', 'false',
               'issuer_record', 'doc_settle', '2026-02-01T00:00:00Z', '2026-01-01')`,
    );
    return one(z.object({ n: z.number(), k: z.number() })).parse(
      await ask(`SELECT n::int, k::int FROM public.originator_track_counts('substack:mixed')`),
    )[0];
  });
  expect(found).toStrictEqual({ n: 8, k: 7 });
});

test('one confirmed fabrication with 20 true of 22 gives E', async () => {
  const found = await run(async (ask) => {
    await settler(ask);
    await ensure(ask, 'substack:fab');
    await clusters(ask, 'substack:fab', 22, 20);
    await aged(ask, 'substack:fab', 'C', 200);
    await ask(
      `UPDATE public.originator_resolution
          SET outcome = 'fabricated', fabrication_confirmed_at = now()
        WHERE claim_document = 'doc_substackfab_22'`,
    );
    return letterOf(ask, 'substack:fab');
  });
  expect(found).toBe('E/track_record');
});

test('an unconfirmed fabrication sets contested and does not change the letter', async () => {
  const held = await run(async (ask) => {
    await settler(ask);
    await ensure(ask, 'substack:fab');
    await clusters(ask, 'substack:fab', 22, 22);
    await ask(
      `INSERT INTO public.documents (id, kind, title, uri, retrieved_at)
       VALUES ('doc_cl', 'url', 'a page', 'https://example.org/cl', current_date)`,
    );
    await ask(`SELECT public.refresh_originator('substack:fab')`);
    const before = await storedLetter(ask, 'substack:fab');
    await ask(
      `SELECT public.record_resolution('substack:fab', gen_random_uuid(), 'doc_cl', 'first',
                'fabricated', 'issuer_record', 'doc_settle', NULL, '2026-02-01T00:00:00Z',
                '2026-01-01')`,
    );
    return {
      before,
      after: await storedLetter(ask, 'substack:fab'),
      flags: await flagsOf(ask, 'substack:fab'),
    };
  });
  expect(held.after).toBe(held.before);
  expect(held.flags.contested).toBe(true);
});

test('a missing band row turns that band off, and the letter falls to the next band', async () => {
  const found = await run(async (ask) => {
    await settler(ask);
    await setParameter(ask, 'letter_b_wilson_lower', null);
    await setParameter(ask, 'letter_first_cap_c', null);
    await ensure(ask, 'substack:band');
    await clusters(ask, 'substack:band', 22);
    return letterOf(ask, 'substack:band');
  });
  expect(found).toBe('C/track_record');
});

test('a missing Wilson z turns every measured band off', async () => {
  const found = await run(async (ask) => {
    await settler(ask);
    await setParameter(ask, 'letter_wilson_z', null);
    await ensure(ask, 'substack:band');
    await clusters(ask, 'substack:band', 30);
    return letterOf(ask, 'substack:band');
  });
  expect(found).toBe('F/track_record');
});

test('a letter moves one step per 90 days: C, then B on day 90, then A on day 180', async () => {
  const letters = await run(async (ask) => {
    await settler(ask);
    await ensure(ask, 'substack:climb');
    await clusters(ask, 'substack:climb', 75);
    const day = (n: number) => new Date(Date.parse(AS_OF) + n * 86_400_000).toISOString();
    const seen: string[] = [];
    for (const n of [0, 89, 90, 179, 180]) {
      await refresh(ask, 'substack:climb', day(n));
      seen.push((await storedLetter(ask, 'substack:climb')).split('/')[0] ?? '');
    }
    return seen;
  });
  expect(letters).toStrictEqual(['C', 'C', 'B', 'B', 'A']);
});

// ------------------------------------------------------------------------------ the register ---

test('an approved register card gives its issuer A with letter_origin register', async () => {
  const found = await run(async (ask) => {
    await ensure(ask, 'host:ofac.treasury.gov', 'OFAC', 'state_body', 'US');
    await card(ask, 'host:ofac.treasury.gov', ['ofac.treasury.gov'], 'US');
    await refresh(ask, 'host:ofac.treasury.gov');
    return storedLetter(ask, 'host:ofac.treasury.gov');
  });
  expect(found).toBe('A/register');
});

test('issuer_card_for returns the card whose host and pattern match, and NULL otherwise', async () => {
  const found = await run(async (ask) => {
    await ensure(ask, 'host:ofac.treasury.gov', 'OFAC', 'state_body', 'US');
    await card(ask, 'host:ofac.treasury.gov', ['ofac.treasury.gov'], 'US', ['%/recent-actions/%']);
    const ask1 = async (uri: string) =>
      z
        .array(z.object({ issuer: z.string().nullable() }))
        .parse(await ask('SELECT (public.issuer_card_for($1)).issuer_id AS issuer', [uri]))[0]
        ?.issuer ?? null;
    return [
      await ask1('https://ofac.treasury.gov/recent-actions/20260301'),
      await ask1('https://ofac.treasury.gov/other'),
      await ask1('https://example.org/recent-actions/1'),
    ];
  });
  expect(found).toStrictEqual(['host:ofac.treasury.gov', null, null]);
});

// -------------------------------------------------------------------------------- the party ---

test('a belligerent state body has party true with no register card and no record', async () => {
  const held = await run(async (ask) => {
    await belligerents(ask);
    await ensure(ask, 'host:war-sanctions.gur.gov.ua', 'GUR', 'state_body', 'UA');
    await refresh(ask, 'host:war-sanctions.gur.gov.ua');
    return {
      flags: await flagsOf(ask, 'host:war-sanctions.gur.gov.ua'),
      letter: await storedLetter(ask, 'host:war-sanctions.gur.gov.ua'),
    };
  });
  expect(held.flags.party).toBe('true');
  expect(held.letter).toBe('F/track_record');
});

test('a jurisdiction outside the belligerents with no record gives unknown and never false', async () => {
  const found = await run(async (ask) => {
    await belligerents(ask);
    await ensure(ask, 'substack:analyst', 'An analyst', 'person', 'GB');
    await refresh(ask, 'substack:analyst');
    return (await flagsOf(ask, 'substack:analyst')).party;
  });
  expect(found).toBe('unknown');
});

const factText = 'The Ministry of Defence of Russia owns Channel Z through a decree of 2024.';

const textDocument = async (ask: Ask, id: string, uri: string, text: string): Promise<void> => {
  await ask(
    `INSERT INTO public.documents (id, kind, title, uri, retrieved_at)
     VALUES ($1, 'url', 'a record', $2, current_date)`,
    [id, uri],
  );
  await ask(
    `INSERT INTO public.document_text (document_id, extractor, page, text) VALUES ($1, 'text-1', 1, $2)`,
    [id, text],
  );
};

// A controller fact and a no-belligerent-control fact need a document on a loaded register card.
const registeredDocument = async (
  ask: Ask,
  id: string,
  uri: string,
  text: string,
): Promise<void> => {
  const host = new URL(uri).hostname;
  await ensure(ask, `host:${host}`, host, 'organisation');
  await card(ask, `host:${host}`, [host]);
  await textDocument(ask, id, uri, text);
};

const propose = async (
  ask: Ask,
  originator: string,
  kind: string,
  value: unknown,
  document: string,
  text: string,
  contains: string,
): Promise<string> => {
  const start = Math.max(text.indexOf(contains), 0);
  return statusOf(
    ask,
    'public.propose_originator_fact',
    originator,
    kind,
    JSON.stringify(value),
    document,
    1,
    start,
    start + contains.length,
  );
};

const decide = (ask: Ask, id: string): Promise<string> =>
  statusOf(ask, 'public.decide_originator_fact', id);

const factStatus = async (ask: Ask, id: string) =>
  first(
    one(z.object({ status: z.string(), refused_reason: z.string().nullable() })).parse(
      await ask('SELECT status, refused_reason FROM public.originator_fact WHERE id = $1::uuid', [
        id,
      ]),
    ),
  );

test('an accepted controller fact that names a belligerent gives party true', async () => {
  const held = await run(async (ask) => {
    await belligerents(ask);
    await ensure(ask, 'telegram:77', 'Channel Z');
    await registeredDocument(ask, 'doc_decree', 'https://example.org/decree', factText);
    const id = await propose(
      ask,
      'telegram:77',
      'controller',
      { controller: 'RU', name: 'Ministry of Defence of Russia', relation: 'owns' },
      'doc_decree',
      factText,
      'Ministry of Defence of Russia',
    );
    await decide(ask, id);
    return { fact: await factStatus(ask, id), flags: await flagsOf(ask, 'telegram:77') };
  });
  expect(held.fact.status).toBe('accepted');
  expect(held.flags.party).toBe('true');
});

test('a controller fact on a document that is on no register card is refused', async () => {
  const held = await run(async (ask) => {
    await belligerents(ask);
    await ensure(ask, 'telegram:77', 'Channel Z');
    await textDocument(ask, 'doc_decree', 'https://example.org/decree', factText);
    const id = await propose(
      ask,
      'telegram:77',
      'controller',
      { controller: 'RU', name: 'Ministry of Defence of Russia', relation: 'owns' },
      'doc_decree',
      factText,
      'Ministry of Defence of Russia',
    );
    await decide(ask, id);
    return { fact: await factStatus(ask, id), flags: await flagsOf(ask, 'telegram:77') };
  });
  expect(held.fact.status).toBe('refused');
  expect(held.fact.refused_reason).toMatch(/register card/);
  expect(held.flags.party).toBe('unknown');
});

test('a no-belligerent-control fact on a document that is on no register card is refused', async () => {
  const text = 'Companies House record: registered in the United Kingdom, no belligerent owner.';
  const held = await run(async (ask) => {
    await belligerents(ask);
    await ensure(ask, 'substack:ok', 'Outlet', 'organisation', 'GB');
    await textDocument(ask, 'doc_ch', 'https://example.org/ch', text);
    const id = await propose(
      ask,
      'substack:ok',
      'no_belligerent_control',
      { jurisdiction: 'GB', jurisdiction_name: 'United Kingdom', registry: 'Companies House' },
      'doc_ch',
      text,
      'United Kingdom',
    );
    await decide(ask, id);
    return { fact: await factStatus(ask, id), flags: await flagsOf(ask, 'substack:ok') };
  });
  expect(held.fact.status).toBe('refused');
  expect(held.fact.refused_reason).toMatch(/register card/);
  expect(held.flags.party).toBe('unknown');
});

test('a controller fact whose span lacks the controller name is refused', async () => {
  const held = await run(async (ask) => {
    await belligerents(ask);
    await ensure(ask, 'telegram:77', 'Channel Z');
    await registeredDocument(ask, 'doc_decree', 'https://example.org/decree', factText);
    const id = await propose(
      ask,
      'telegram:77',
      'controller',
      { controller: 'RU', name: 'Ministry of Finance', relation: 'owns' },
      'doc_decree',
      factText,
      'owns Channel Z',
    );
    await decide(ask, id);
    return { fact: await factStatus(ask, id), flags: await flagsOf(ask, 'telegram:77') };
  });
  expect(held.fact.status).toBe('refused');
  expect(held.fact.refused_reason).toMatch(/span/);
  expect(held.flags.party).toBe('unknown');
});

test('a fact with a Wikidata address and no stored span is refused', async () => {
  const held = await run(async (ask) => {
    await belligerents(ask);
    await ensure(ask, 'telegram:77', 'Channel Z');
    await ask(
      `INSERT INTO public.documents (id, kind, title, uri, retrieved_at)
       VALUES ('doc_wd', 'url', 'wikidata', 'https://www.wikidata.org/wiki/Q1', current_date)`,
    );
    const id = await statusOf(
      ask,
      'public.propose_originator_fact',
      'telegram:77',
      'controller',
      JSON.stringify({ controller: 'RU', name: 'Ministry of Defence', relation: 'owns' }),
      'doc_wd',
      1,
      0,
      20,
    );
    await decide(ask, id);
    return { fact: await factStatus(ask, id), flags: await flagsOf(ask, 'telegram:77') };
  });
  expect(held.fact.status).toBe('refused');
  expect(held.flags.party).toBe('unknown');
});

test('a fact with no span offsets is refused by the proposing door', async () => {
  await expect(
    run(async (ask) => {
      await ensure(ask, 'telegram:77', 'Channel Z');
      await registeredDocument(ask, 'doc_decree', 'https://example.org/decree', factText);
      await ask(
        `SELECT public.propose_originator_fact('telegram:77', 'controller',
           '{"controller":"RU","name":"Ministry","relation":"owns"}'::jsonb,
           'doc_decree', 1, NULL, NULL)`,
      );
    }),
  ).rejects.toThrow();
});

test('a decided fact is not decided again', async () => {
  const found = await run(async (ask) => {
    await belligerents(ask);
    await ensure(ask, 'telegram:77', 'Channel Z');
    await registeredDocument(ask, 'doc_decree', 'https://example.org/decree', factText);
    const id = await propose(
      ask,
      'telegram:77',
      'controller',
      { controller: 'RU', name: 'Ministry of Defence of Russia', relation: 'owns' },
      'doc_decree',
      factText,
      'Ministry of Defence of Russia',
    );
    return [await decide(ask, id), await decide(ask, id)];
  });
  expect(found).toStrictEqual(['accepted', 'accepted']);
});

test('party false needs a no-belligerent-control fact and a jurisdiction outside the belligerents', async () => {
  const text = 'Companies House record: registered in the United Kingdom, no belligerent owner.';
  const found = await run(async (ask) => {
    await belligerents(ask);
    await ensure(ask, 'substack:ok', 'Outlet', 'organisation', 'GB');
    await ensure(ask, 'substack:ru', 'Outlet RU', 'organisation', 'RU');
    await registeredDocument(
      ask,
      'doc_ch',
      'https://find-and-update.company-information.service.gov.uk/1',
      text,
    );
    const good = await propose(
      ask,
      'substack:ok',
      'no_belligerent_control',
      { jurisdiction: 'GB', jurisdiction_name: 'United Kingdom', registry: 'Companies House' },
      'doc_ch',
      text,
      'United Kingdom',
    );
    await decide(ask, good);
    const bad = await propose(
      ask,
      'substack:ru',
      'no_belligerent_control',
      { jurisdiction: 'GB', jurisdiction_name: 'United Kingdom', registry: 'Companies House' },
      'doc_ch',
      text,
      'United Kingdom',
    );
    await decide(ask, bad);
    return [(await flagsOf(ask, 'substack:ok')).party, (await flagsOf(ask, 'substack:ru')).party];
  });
  expect(found).toStrictEqual(['false', 'unknown']);
});

test('set_party_false sets party false with a reason, and true still wins', async () => {
  const found = await run(async (ask) => {
    await belligerents(ask);
    await ensure(ask, 'substack:a', 'A');
    await ask(`SELECT public.set_party_false('substack:a', 'the operator checked the ownership')`);
    await ensure(ask, 'host:state.ru', 'State', 'state_body', 'RU');
    await ask(`SELECT public.set_party_false('host:state.ru', 'a mistaken act')`);
    return [(await flagsOf(ask, 'substack:a')).party, (await flagsOf(ask, 'host:state.ru')).party];
  });
  expect(found).toStrictEqual(['false', 'true']);
});

test('an operator door refuses a blank reason', async () => {
  await expect(
    run(async (ask) => {
      await ensure(ask, 'substack:a', 'A');
      await ask(`SELECT public.set_party_false('substack:a', '   ')`);
    }),
  ).rejects.toThrow(/reason/);
});

// ----------------------------------------------------------------------------- the sanctions ---

const EU_TEXT = 'Council Regulation: entry EU-12345 lists the outlet Channel Z.';

test('an accepted EU sanction entry fact writes a sanction row with its entry id', async () => {
  const rows = await run(async (ask) => {
    await ensure(ask, 'host:eur-lex.europa.eu', 'EUR-Lex', 'organisation', 'EU');
    await card(ask, 'host:eur-lex.europa.eu', ['eur-lex.europa.eu'], 'EU');
    await ensure(ask, 'telegram:77', 'Channel Z');
    await textDocument(ask, 'doc_eu', 'https://eur-lex.europa.eu/legal-content/x', EU_TEXT);
    const id = await propose(
      ask,
      'telegram:77',
      'sanction_entry',
      { regime: 'EU', list_entry_id: 'EU-12345', listed_on: '2026-03-01' },
      'doc_eu',
      EU_TEXT,
      'EU-12345',
    );
    await decide(ask, id);
    return z
      .array(z.object({ regime: z.string(), list_entry_id: z.string(), source: z.string() }))
      .parse(
        await ask(
          `SELECT regime, list_entry_id, source FROM public.originator_sanction
            WHERE originator_id = 'telegram:77'`,
        ),
      );
  });
  expect(rows).toStrictEqual([
    { regime: 'EU', list_entry_id: 'EU-12345', source: 'list_document' },
  ]);
});

test('a sanction entry fact from a UK-list card writes no row', async () => {
  const held = await run(async (ask) => {
    await ensure(ask, 'host:ofsi.example', 'OFSI', 'organisation', 'GB');
    await card(ask, 'host:ofsi.example', ['ofsi.example'], 'UK');
    await ensure(ask, 'telegram:77', 'Channel Z');
    await textDocument(ask, 'doc_uk', 'https://ofsi.example/list', EU_TEXT);
    const id = await propose(
      ask,
      'telegram:77',
      'sanction_entry',
      { regime: 'EU', list_entry_id: 'EU-12345', listed_on: '2026-03-01' },
      'doc_uk',
      EU_TEXT,
      'EU-12345',
    );
    await decide(ask, id);
    return {
      fact: await factStatus(ask, id),
      rows: await ask(
        `SELECT 1 FROM public.originator_sanction WHERE originator_id = 'telegram:77'`,
      ),
    };
  });
  expect(held.fact.status).toBe('refused');
  expect(held.rows).toHaveLength(0);
});

test('a sanctioned host row writes a sanction row at refresh', async () => {
  const rows = await run(async (ask) => {
    await ensure(ask, 'host:ria.example', 'RIA', 'organisation');
    await ask(
      `INSERT INTO public.sanctioned_hosts
         (outlet, host_or_account, regime, list_entry_id, list_url, approved_sha256, approved_on)
       VALUES ('RIA', 'ria.example', 'EU', 'EU-777', 'https://eur-lex.europa.eu/x', $1, '2026-03-01')`,
      [HASH],
    );
    await refresh(ask, 'host:ria.example');
    return z
      .array(z.object({ regime: z.string(), list_entry_id: z.string(), source: z.string() }))
      .parse(
        await ask(
          `SELECT regime, list_entry_id, source FROM public.originator_sanction
            WHERE originator_id = 'host:ria.example'`,
        ),
      );
  });
  expect(rows).toStrictEqual([{ regime: 'EU', list_entry_id: 'EU-777', source: 'host_table' }]);
});

const HOST_ROW = `INSERT INTO public.sanctioned_hosts
  (outlet, host_or_account, regime, list_entry_id, list_url, approved_sha256, approved_on`;

test('a sanctioned host row with the regime UK or no list entry is refused', async () => {
  await expect(
    run((ask) =>
      ask(
        `${HOST_ROW}) VALUES ('RIA', 'ria.example', 'UK', 'UK-1', 'https://x.example', $1, '2026-03-01')`,
        [HASH],
      ),
    ),
  ).rejects.toThrow();
  await expect(
    run((ask) =>
      ask(
        `${HOST_ROW}) VALUES ('RIA', 'ria.example', 'EU', NULL, 'https://x.example', $1, '2026-03-01')`,
        [HASH],
      ),
    ),
  ).rejects.toThrow();
  await expect(
    run((ask) =>
      ask(
        `${HOST_ROW}) VALUES ('RIA', 'ria.example', 'EU', '  ', 'https://x.example', $1, '2026-03-01')`,
        [HASH],
      ),
    ),
  ).rejects.toThrow();
});

test('a homonym with a different registration number is refused, and the same number passes', async () => {
  const insert = (outletRegistration: string, entryRegistration: string) =>
    run((ask) =>
      ask(
        `${HOST_ROW}, outlet_registration, entry_registration)
         VALUES ('Channel Z', 'z.example', 'EU', 'EU-9', 'https://x.example', $1, '2026-03-01',
                 $2, $3)`,
        [HASH, outletRegistration, entryRegistration],
      ),
    );
  await expect(insert('1027700000001', '1027700000002')).rejects.toThrow();
  await insert('1027700000001', '1027700000001');
});

const holdingSetup = async (ask: Ask, share: number | string): Promise<string> => {
  await ensure(ask, 'host:holding.example', 'Holding', 'organisation');
  await ask(
    `${HOST_ROW}) VALUES ('Holding', 'holding.example', 'EU', 'EU-31', 'https://x.example', $1,
             '2026-03-01')`,
    [HASH],
  );
  await refresh(ask, 'host:holding.example');
  await ensure(ask, 'host:outlet.example', 'Outlet', 'organisation');
  const text = 'Register extract: Holding owns the outlet with a share of capital.';
  await registeredDocument(ask, 'doc_reg', 'https://example.org/register', text);
  const id = await propose(
    ask,
    'host:outlet.example',
    'controller',
    { controller: 'host:holding.example', name: 'Holding', relation: 'owns', share },
    'doc_reg',
    text,
    'Holding',
  );
  await decide(ask, id);
  return id;
};

test('an outlet 60 percent held by a listed holding is sanctioned-controlled', async () => {
  const held = await run(async (ask) => {
    await holdingSetup(ask, 60);
    return (await flagsOf(ask, 'host:outlet.example')).sanctioned_controlled;
  });
  expect(held).toBe(true);
});

test('a 40 percent share, a missing parameter row and a bad share give no control flag', async () => {
  const found = await run(async (ask) => {
    await holdingSetup(ask, 40);
    const low = (await flagsOf(ask, 'host:outlet.example')).sanctioned_controlled;
    await setParameter(ask, 'sanction_control_share', null);
    await refresh(ask, 'host:outlet.example');
    return [low, (await flagsOf(ask, 'host:outlet.example')).sanctioned_controlled];
  });
  expect(found).toStrictEqual([false, false]);

  const gone = await run(async (ask) => {
    await setParameter(ask, 'sanction_control_share', null);
    await holdingSetup(ask, 60);
    return (await flagsOf(ask, 'host:outlet.example')).sanctioned_controlled;
  });
  expect(gone).toBe(false);

  const refused = await run(async (ask) => {
    const id = await holdingSetup(ask, 'sixty');
    return factStatus(ask, id);
  });
  expect(refused.status).toBe('refused');

  const above = await run(async (ask) => {
    const id = await holdingSetup(ask, 140);
    return factStatus(ask, id);
  });
  expect(above.status).toBe('refused');
});

test('an expired flag shows as unchecked in the card, and it never changes the letter', async () => {
  const held = await run(async (ask) => {
    await ensure(ask, 'host:ria.example', 'RIA', 'organisation');
    await ask(
      `${HOST_ROW}, checked_until)
       VALUES ('RIA', 'ria.example', 'EU', 'EU-777', 'https://x.example', $1, '2026-03-01',
               '2020-01-01')`,
      [HASH],
    );
    const before = await letterOf(ask, 'host:ria.example');
    await refresh(ask, 'host:ria.example');
    return {
      before,
      after: await storedLetter(ask, 'host:ria.example'),
      card: one(z.object({ sanctions: z.array(z.object({ checked: z.boolean() })) })).parse(
        await ask(`SELECT sanctions FROM api.originator_card WHERE id = 'host:ria.example'`),
      )[0],
    };
  });
  expect(held.card?.sanctions).toStrictEqual([expect.objectContaining({ checked: false })]);
  expect(held.after).toBe(held.before);
});

// ----------------------------------------------------------------------------- the resolution ---

const resolution = (position: string, outcome: string, settledBy: string, note: string | null) =>
  `SELECT public.record_resolution('substack:r', gen_random_uuid(), 'doc_cl', '${position}',
            '${outcome}', '${settledBy}', ${note === null ? "'doc_settle'" : 'NULL'},
            ${note === null ? 'NULL' : `'${note}'`}, '2026-02-01T00:00:00Z', '2026-01-01')`;

const resolutionFixture = async (ask: Ask): Promise<void> => {
  await settler(ask);
  await ensure(ask, 'substack:r');
  await ask(
    `INSERT INTO public.documents (id, kind, title, uri, retrieved_at)
     VALUES ('doc_cl', 'url', 'a page', 'https://example.org/cl', current_date)`,
  );
};

test('record_resolution writes a settled first claim', async () => {
  const n = await run(async (ask) => {
    await resolutionFixture(ask);
    await ask(resolution('first', 'true', 'issuer_record', null));
    return ask(`SELECT 1 FROM public.originator_resolution WHERE originator_id = 'substack:r'`);
  });
  expect(n).toHaveLength(1);
});

test('record_resolution refuses a repeater position', async () => {
  await expect(
    run(async (ask) => {
      await resolutionFixture(ask);
      await ask(resolution('repeater', 'true', 'issuer_record', null));
    }),
  ).rejects.toThrow(/position/);
});

test('record_resolution refuses a rule-accepted claim and an agent agreement as ground truth', async () => {
  for (const settledBy of ['rule_accepted', 'agent_agreement', 'media_agreement'])
    await expect(
      run(async (ask) => {
        await resolutionFixture(ask);
        await ask(resolution('first', 'true', settledBy, null));
      }),
    ).rejects.toThrow(/settled_by|ground truth/);
});

test('record_resolution refuses a settling record captured before the claim document', async () => {
  await expect(
    run(async (ask) => {
      await resolutionFixture(ask);
      await ask(
        `SELECT public.record_resolution('substack:r', gen_random_uuid(), 'doc_cl', 'first',
                  'true', 'issuer_record', 'doc_settle', NULL, '2025-12-01T00:00:00Z',
                  '2026-01-01')`,
      );
    }),
  ).rejects.toThrow(/before|captured/);
});

test('record_resolution refuses a settling document that is the claim document', async () => {
  await expect(
    run(async (ask) => {
      await resolutionFixture(ask);
      await ask(
        `SELECT public.record_resolution('substack:r', gen_random_uuid(), 'doc_cl', 'first',
                  'true', 'issuer_record', 'doc_cl', NULL, '2026-02-01T00:00:00Z', '2026-01-01')`,
      );
    }),
  ).rejects.toThrow(/claim document|circular/);
});

test('record_resolution takes an operator decision that names its note', async () => {
  await run(async (ask) => {
    await resolutionFixture(ask);
    await ask(
      resolution('first_hand', 'false', 'operator_decision', 'the operator checked the filing'),
    );
  });
  await expect(
    run(async (ask) => {
      await resolutionFixture(ask);
      await ask(resolution('first', 'false', 'operator_decision', '  '));
    }),
  ).rejects.toThrow();
});

// ------------------------------------------------------------------------- the operator letter ---

test('an operator letter B with 0 of 6 keeps B, gets contested, and is queued', async () => {
  const held = await run(async (ask) => {
    await settler(ask);
    await ensure(ask, 'substack:op');
    await ask(`SELECT public.set_operator_letter('substack:op', 'B', 'a reviewed analyst')`);
    await clusters(ask, 'substack:op', 6, 0);
    await refresh(ask, 'substack:op');
    return {
      stored: await storedLetter(ask, 'substack:op'),
      flags: await flagsOf(ask, 'substack:op'),
      queue: z
        .array(z.object({ originator_id: z.string(), reason: z.string() }))
        .parse(await ask('SELECT originator_id, reason FROM public.originator_exceptions()')),
    };
  });
  expect(held.stored).toBe('B/operator');
  expect(held.flags.contested).toBe(true);
  expect(held.queue).toContainEqual({ originator_id: 'substack:op', reason: 'contested' });
});

test('after set_operator_letter the contest is clear and a refresh does not set it again', async () => {
  const flags = await run(async (ask) => {
    await settler(ask);
    await ensure(ask, 'substack:op');
    await ask(`SELECT public.set_operator_letter('substack:op', 'B', 'a reviewed analyst')`);
    await clusters(ask, 'substack:op', 6, 0);
    await refresh(ask, 'substack:op');
    await ask(`SELECT public.set_operator_letter('substack:op', 'C', 'seen the six failures')`);
    const cleared = await flagsOf(ask, 'substack:op');
    await refresh(ask, 'substack:op');
    return { cleared, again: await flagsOf(ask, 'substack:op') };
  });
  expect(flags.cleared.contested).toBe(false);
  expect(flags.again.contested).toBe(false);
});

test('one confirmed fabrication on an operator-letter originator gives E', async () => {
  const found = await run(async (ask) => {
    await resolutionFixture(ask);
    await ask(`SELECT public.set_operator_letter('substack:r', 'A', 'a trusted source')`);
    const [row] = z
      .array(z.object({ id: z.string() }))
      .parse(await ask(resolution('first', 'fabricated', 'issuer_record', null) + ' AS id'));
    await ask(`SELECT public.confirm_fabrication($1::uuid, 'the item was doctored')`, [row?.id]);
    return storedLetter(ask, 'substack:r');
  });
  expect(found).toBe('E/track_record');
});

test('an operator letter on an id that collides with a name is kept', async () => {
  const found = await run(async (ask) => {
    await ensure(ask, 'host:reuters.com', 'Reuters', 'organisation');
    await ensure(ask, 'telegram:123', 'Reuters');
    await ask(`SELECT public.set_operator_letter('telegram:123', 'C', 'checked once by hand')`);
    return storedLetter(ask, 'telegram:123');
  });
  expect(found).toBe('C/operator');
});

test('an operator letter has no expiry: ten years later it is the same', async () => {
  const found = await run(async (ask) => {
    await ensure(ask, 'substack:op');
    await ask(`SELECT public.set_operator_letter('substack:op', 'A', 'a reviewed source')`);
    return [
      await letterOf(ask, 'substack:op', AS_OF),
      await letterOf(ask, 'substack:op', '2040-01-01T00:00:00Z'),
    ];
  });
  expect(found).toStrictEqual(['A/operator', 'A/operator']);
});

test('a false resolution on an operator-letter originator sets contested', async () => {
  const flags = await run(async (ask) => {
    await resolutionFixture(ask);
    await ask(`SELECT public.set_operator_letter('substack:r', 'B', 'a reviewed analyst')`);
    await ask(resolution('first', 'false', 'issuer_record', null));
    return flagsOf(ask, 'substack:r');
  });
  expect(flags.contested).toBe(true);
});

test('only a false or fabricated outcome labels an originator, and a true outcome never sets contested', async () => {
  const held = await run(async (ask) => {
    await resolutionFixture(ask);
    await ask(`SELECT public.set_operator_letter('substack:r', 'B', 'a reviewed analyst')`);
    await ask(resolution('first', 'true', 'issuer_record', null));
    await ask(resolution('first_hand', 'true', 'verified_observation', null));
    return flagsOf(ask, 'substack:r');
  });
  expect(held.contested).toBe(false);
  await expect(
    run(async (ask) => {
      await resolutionFixture(ask);
      await ask(resolution('first', 'source_false', 'issuer_record', null));
    }),
  ).rejects.toThrow();
});

test('a false resolution on an originator with no operator letter sets nothing', async () => {
  const flags = await run(async (ask) => {
    await resolutionFixture(ask);
    await ask(resolution('first', 'false', 'issuer_record', null));
    return flagsOf(ask, 'substack:r');
  });
  expect(flags.contested).toBe(false);
});

test('remove_operator_letter gives the track-record letter', async () => {
  const found = await run(async (ask) => {
    await ensure(ask, 'substack:op');
    await ask(`SELECT public.set_operator_letter('substack:op', 'A', 'a reviewed source')`);
    await ask(`SELECT public.remove_operator_letter('substack:op', 'the review failed')`);
    return storedLetter(ask, 'substack:op');
  });
  expect(found).toBe('F/track_record');
});

test('set_operator_letter creates the originator when it is absent', async () => {
  const found = await run(async (ask) => {
    await ask(`SELECT public.set_operator_letter('host:newsource.example', 'B', 'loaded by hand')`);
    return storedLetter(ask, 'host:newsource.example');
  });
  expect(found).toBe('B/operator');
});

// ----------------------------------------------------------------------- the impersonation ---

test('a lookalike id stays F with 22 of 22 until the merge, then takes the target letter', async () => {
  const found = await run(async (ask) => {
    await settler(ask);
    await ensure(ask, 'host:reuters.com', 'Reuters', 'organisation');
    await card(ask, 'host:reuters.com', ['reuters.com']);
    await refresh(ask, 'host:reuters.com');
    await ensure(ask, 'telegram:123', '  REUTERS ');
    await clusters(ask, 'telegram:123', 22);
    await aged(ask, 'telegram:123', 'C', 200);
    await refresh(ask, 'telegram:123');
    const before = await storedLetter(ask, 'telegram:123');
    const collides = (await flagsOf(ask, 'telegram:123')).name_collides_with;
    await ask(
      `SELECT public.merge_originator('telegram:123', 'host:reuters.com', 'the same desk')`,
    );
    return { before, collides, after: await storedLetter(ask, 'telegram:123') };
  });
  expect(found).toStrictEqual({
    before: 'F/track_record',
    collides: 'host:reuters.com',
    after: 'A/register',
  });
});

test('a name collision is listed for the operator', async () => {
  const queue = await run(async (ask) => {
    await ensure(ask, 'host:reuters.com', 'Reuters', 'organisation');
    await ensure(ask, 'telegram:123', 'Reuters');
    return z
      .array(z.object({ originator_id: z.string(), reason: z.string() }))
      .parse(await ask('SELECT originator_id, reason FROM public.originator_exceptions()'));
  });
  expect(queue).toContainEqual({ originator_id: 'telegram:123', reason: 'name_collision' });
});

// ---------------------------------------------------------------------------- the staff author ---

test('a staff author gets the imprint letter on the imprint host and its own letter elsewhere', async () => {
  const found = await run(async (ask) => {
    await ensure(ask, 'host:tass.com', 'TASS', 'organisation');
    await ask(`SELECT public.set_operator_letter('host:tass.com', 'B', 'a reviewed agency')`);
    await ensure(ask, 'x:555', 'A reporter', 'person');
    await ask(`SELECT public.link_imprint('x:555', 'host:tass.com', 'byline checked by hand')`);
    for (const [id, uri] of [
      ['doc_on', 'https://tass.com/politics/1'],
      ['doc_off', 'https://elsewhere.example/politics/1'],
    ] as const)
      await ask(
        `INSERT INTO public.documents (id, kind, title, uri, retrieved_at)
         VALUES ($1, 'url', 'a page', $2, current_date)`,
        [id, uri],
      );
    const letterFor = async (document: string) =>
      z
        .array(z.object({ letter: z.string() }))
        .parse(
          await ask('SELECT public.originator_letter_for($1, $2) AS letter', ['x:555', document]),
        )[0]?.letter;
    return [await letterFor('doc_on'), await letterFor('doc_off')];
  });
  expect(found).toStrictEqual(['B', 'F']);
});

test('a staff author with ten resolved claims keeps its own letter', async () => {
  const found = await run(async (ask) => {
    await settler(ask);
    await ensure(ask, 'host:tass.com', 'TASS', 'organisation');
    await ask(`SELECT public.set_operator_letter('host:tass.com', 'B', 'a reviewed agency')`);
    await ensure(ask, 'x:555', 'A reporter', 'person');
    await ask(`SELECT public.link_imprint('x:555', 'host:tass.com', 'byline checked by hand')`);
    await clusters(ask, 'x:555', 10, 0);
    await ask(
      `INSERT INTO public.documents (id, kind, title, uri, retrieved_at)
       VALUES ('doc_on', 'url', 'a page', 'https://tass.com/politics/1', current_date)`,
    );
    return z
      .array(z.object({ letter: z.string() }))
      .parse(await ask(`SELECT public.originator_letter_for('x:555', 'doc_on') AS letter`))[0]
      ?.letter;
  });
  expect(found).not.toBe('B');
});

// ------------------------------------------------------------------------------ gold set ---

test('a gold-set letter sets an own algorithm and no other originator', async () => {
  const found = await run(async (ask) => {
    await ensure(
      ask,
      'gab:geolocation-check:v1',
      'Geolocation check',
      'own_algorithm',
      null,
      'own_algorithm',
    );
    await ask(
      `SELECT public.set_gold_set_letter('gab:geolocation-check:v1', 'B', 'gold-set run 1')`,
    );
    return storedLetter(ask, 'gab:geolocation-check:v1');
  });
  expect(found).toBe('B/gold_set');
  await expect(
    run(async (ask) => {
      await ensure(ask, 'substack:a', 'A');
      await ask(`SELECT public.set_gold_set_letter('substack:a', 'B', 'gold-set run 1')`);
    }),
  ).rejects.toThrow(/algorithm/);
});

// ---------------------------------------------------------------------------- the history ---

test('each letter change writes one history row with the gate not re-run, and a repeat writes none', async () => {
  const held = await run(async (ask) => {
    await ensure(ask, 'substack:h');
    await ask(`SELECT public.set_operator_letter('substack:h', 'B', 'a reviewed analyst')`);
    await refresh(ask, 'substack:h');
    await refresh(ask, 'substack:h');
    const afterOne = await historyOf(ask, 'substack:h');
    await ask(`SELECT public.set_operator_letter('substack:h', 'C', 'a lower prior')`);
    return { afterOne, afterTwo: await historyOf(ask, 'substack:h') };
  });
  expect(held.afterOne).toStrictEqual([{ letter: 'B', gate_rerun_at: null }]);
  expect(held.afterTwo).toStrictEqual([
    { letter: 'B', gate_rerun_at: null },
    { letter: 'C', gate_rerun_at: null },
  ]);
});

test('ack_letter_change marks the gate as re-run and the history stays append-only', async () => {
  const held = await run(async (ask) => {
    await ensure(ask, 'substack:h');
    await ask(`SELECT public.set_operator_letter('substack:h', 'B', 'a reviewed analyst')`);
    const [row] = z
      .array(z.object({ id: z.string() }))
      .parse(
        await ask(
          `SELECT id FROM public.originator_letter_history WHERE originator_id = 'substack:h'`,
        ),
      );
    await ask('SELECT public.ack_letter_change($1::uuid)', [row?.id]);
    return historyOf(ask, 'substack:h');
  });
  expect(held[0]?.gate_rerun_at).toBeInstanceOf(Date);

  await expect(
    run(async (ask) => {
      await ensure(ask, 'substack:h');
      await ask(`SELECT public.set_operator_letter('substack:h', 'B', 'a reviewed analyst')`);
      await ask(`UPDATE public.originator_letter_history SET letter = 'A'`);
    }),
  ).rejects.toThrow();
  await expect(
    run(async (ask) => {
      await ensure(ask, 'substack:h');
      await ask(`SELECT public.set_operator_letter('substack:h', 'B', 'a reviewed analyst')`);
      await ask(`DELETE FROM public.originator_letter_history`);
    }),
  ).rejects.toThrow();
});

// ----------------------------------------------------------------------------- the card view ---

test('api.originator_card has no letter column', async () => {
  const columns = await run(async (ask) =>
    z.array(z.object({ column_name: z.string() })).parse(
      await ask(
        `SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'api' AND table_name = 'originator_card'`,
      ),
    ),
  );
  const names = columns.map((column) => column.column_name);
  expect(names.length).toBeGreaterThan(5);
  expect(names.filter((name) => /^letter$|admiralty|score|digit/.test(name))).toStrictEqual([]);
  expect(names).toContain('letter_origin');
});

test('under 5 resolved claims the track record columns are NULL, and from 5 they show', async () => {
  const held = await run(async (ask) => {
    await settler(ask);
    await ensure(ask, 'substack:few');
    await clusters(ask, 'substack:few', 4);
    const few = one(
      z.object({ n_resolved: z.number().nullable(), resolved_claims: z.unknown() }),
    ).parse(
      await ask(
        `SELECT n_resolved::int, resolved_claims FROM api.originator_card WHERE id = 'substack:few'`,
      ),
    )[0];
    await clusters(ask, 'substack:few', 5, 5, 'more');
    const many = one(
      z.object({ n_resolved: z.number().nullable(), n_true: z.number().nullable() }),
    ).parse(
      await ask(
        `SELECT n_resolved::int, n_true::int FROM api.originator_card WHERE id = 'substack:few'`,
      ),
    )[0];
    return { few, many };
  });
  expect(held.few).toStrictEqual({ n_resolved: null, resolved_claims: null });
  expect(held.many).toStrictEqual({ n_resolved: 9, n_true: 9 });
});

test('the card of a natural person stays hidden until the operator reviews it', async () => {
  const counts = await run(async (ask) => {
    await ensure(ask, 'substack:p', 'A named person', 'person');
    const count = async () =>
      one(z.object({ n: z.number() })).parse(
        await ask(`SELECT count(*)::int AS n FROM api.originator_card WHERE id = 'substack:p'`),
      )[0]?.n;
    const before = await count();
    await ask(
      `SELECT public.review_originator_card('substack:p', 'the card holds public facts only')`,
    );
    return [before, await count()];
  });
  expect(counts).toStrictEqual([0, 1]);
});

test('the queue lists a person card that nobody reviewed', async () => {
  const queue = await run(async (ask) => {
    await ensure(ask, 'substack:p', 'A named person', 'person');
    return z
      .array(z.object({ originator_id: z.string(), reason: z.string() }))
      .parse(await ask('SELECT originator_id, reason FROM public.originator_exceptions()'));
  });
  expect(queue).toContainEqual({ originator_id: 'substack:p', reason: 'card_review' });
});

// -------------------------------------------------------------------------------- the load ---

test('load_trust_list replaces the rows of a list, records the load, and a rerun writes nothing', async () => {
  const held = await run(async (ask) => {
    const rows = JSON.stringify([
      { code: 'RU', name: 'Russia', conflict: 'the war' },
      { code: 'UA', name: 'Ukraine', conflict: 'the war' },
    ]);
    const call = () =>
      statusOf(
        ask,
        'public.load_trust_list',
        'belligerents.csv',
        HASH,
        '2026-03-01',
        'the operator approved the list',
        rows,
      );
    const first = await call();
    const second = await call();
    const loads = await ask(`SELECT 1 FROM public.trust_list_load WHERE file = 'belligerents.csv'`);
    const held = await ask('SELECT 1 FROM public.belligerent');
    return { first, second, loads: loads.length, held: held.length };
  });
  expect(held).toStrictEqual({ first: '2', second: 'null', loads: 1, held: 2 });
});

test('load_trust_list refuses a sanctioned host row whose registration numbers differ', async () => {
  await expect(
    run((ask) =>
      statusOf(
        ask,
        'public.load_trust_list',
        'sanctioned-hosts.csv',
        HASH,
        '2026-03-01',
        'approved',
        JSON.stringify([
          {
            outlet: 'Channel Z',
            host_or_account: 'z.example',
            regime: 'EU',
            list_entry_id: 'EU-9',
            list_url: 'https://x.example',
            outlet_registration: '1',
            entry_registration: '2',
          },
        ]),
      ),
    ),
  ).rejects.toThrow();
});

test('a register card load makes its issuer A and a changed list refreshes the originators', async () => {
  const found = await run(async (ask) => {
    await ensure(ask, 'host:ofac.treasury.gov', 'OFAC', 'state_body', 'US');
    await statusOf(
      ask,
      'public.load_trust_list',
      'register-cards/ofac.yaml',
      HASH,
      '2026-03-01',
      'approved once',
      JSON.stringify([
        {
          issuer: 'host:ofac.treasury.gov',
          hosts: ['ofac.treasury.gov'],
          record_kinds: ['designation'],
          fields: [{ name: 'entry', declarant: 'issuer' }],
          jurisdiction: 'US',
          sanctions_regime: 'US',
        },
      ]),
    );
    return storedLetter(ask, 'host:ofac.treasury.gov');
  });
  expect(found).toBe('A/register');
});

test('the card view counts the clusters as the track record function does', async () => {
  const held = await run(async (ask) => {
    await settler(ask);
    await ensure(ask, 'substack:same');
    await clusters(ask, 'substack:same', 9, 6);
    await ask(
      `INSERT INTO public.originator_resolution
         (originator_id, claim_id, claim_document, position, outcome, settled_by,
          settling_document, settling_captured_at, claim_document_date,
          fabrication_confirmed_at)
       VALUES ('substack:same', gen_random_uuid(), 'doc_substacksame_1', 'first_hand', 'false',
               'issuer_record', 'doc_settle', '2026-02-01T00:00:00Z', '2026-01-01', NULL),
              ('substack:same', gen_random_uuid(), 'doc_substacksame_2', 'first', 'fabricated',
               'issuer_record', 'doc_settle', '2026-02-01T00:00:00Z', '2026-01-01', now()),
              ('substack:same', gen_random_uuid(), 'doc_substacksame_3', 'first', 'fabricated',
               'issuer_record', 'doc_settle', '2026-02-01T00:00:00Z', '2026-01-01', NULL)`,
    );
    const fromFunction = await ask(
      `SELECT n::int, k::int, fabricated::int FROM public.originator_track_counts('substack:same')`,
    );
    const fromView = await ask(
      `SELECT n_resolved::int AS n, n_true::int AS k, n_fabricated::int AS fabricated
         FROM api.originator_card WHERE id = 'substack:same'`,
    );
    return { fromFunction, fromView };
  });
  expect(held.fromFunction).toStrictEqual([{ n: 9, k: 4, fabricated: 1 }]);
  expect(held.fromView).toStrictEqual(held.fromFunction);
});

test('an imprint fact that the operator did not link is listed for the operator', async () => {
  const text = 'By A. Reporter, for the agency TASS.';
  const queue = await run(async (ask) => {
    await ensure(ask, 'host:tass.com', 'TASS', 'organisation');
    await ensure(ask, 'x:555', 'A reporter', 'person');
    await textDocument(ask, 'doc_by', 'https://tass.com/a', text);
    const id = await propose(
      ask,
      'x:555',
      'imprint',
      { imprint: 'host:tass.com', byline: 'A. Reporter' },
      'doc_by',
      text,
      'A. Reporter',
    );
    await decide(ask, id);
    return z
      .array(z.object({ originator_id: z.string(), reason: z.string() }))
      .parse(await ask('SELECT originator_id, reason FROM public.originator_exceptions()'));
  });
  expect(queue).toContainEqual({ originator_id: 'x:555', reason: 'imprint_fact' });
});
