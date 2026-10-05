// A reading holds a page, two offsets and two enums, and the door sets the reader from the job.
// Each gesture runs inside a transaction that rolls back, so the census tests count the same rows.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const DOC = 'doc_claim_reading';
const EXTRACTOR = 'claim-reading-test@1';
const PAGE_ONE = 'The vessel Nayara sailed from Sikka on 3 May 2026.';
const SHA = 'c'.repeat(64);

const PUT = `SELECT public.put_document($1, 'file', 'A test of the claim reading',
  'raw/claim-reading-test.pdf', NULL, NULL, NULL, 'application/pdf', '2026-10-01'::date)`;

const one = z.array(z.object({ id: z.uuid() })).length(1);

const idOf = async (ask: Ask, text: string, values: readonly unknown[] = []): Promise<string> => {
  const [row] = one.parse(await ask(text, values));
  if (row === undefined) throw new Error('no row came back');
  return row.id;
};

const asRole = async <T>(ask: Ask, role: string, work: () => Promise<T>): Promise<T> => {
  await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
  const done = await work();
  await ask('RESET SESSION AUTHORIZATION');
  return done;
};

interface Seeded {
  readonly job: string;
  readonly call: string;
  readonly claim: string;
}

// The job is made the oldest of the queue, so the claim takes it first.
const seed = async (
  ask: Ask,
  kind: 'extract_text' | 'second_read' | 'map_structured',
  claims = true,
): Promise<Seeded> => {
  await ask(PUT, [DOC]);
  await ask('SELECT public.put_document_text($1, $2::jsonb, $3)', [
    DOC,
    JSON.stringify([PAGE_ONE, 'A second page.']),
    EXTRACTOR,
  ]);
  const job = await idOf(
    ask,
    'INSERT INTO public.jobs (document_id, kind) VALUES ($1, $2) RETURNING id',
    [DOC, kind],
  );
  await ask("UPDATE public.jobs SET created_at = '1970-01-01' WHERE id = $1", [job]);
  return asRole(ask, 'gabriel_agent', async () => {
    if (claims) await ask('SELECT * FROM public.claim_job()');
    const call = await idOf(
      ask,
      `SELECT public.record_model_call('extractor', 'v1', 'freellmapi', 'a-model', $1, 10, 'ok',
         $2::uuid, 'a-model') AS id`,
      [SHA, job],
    );
    const claim = await idOf(
      ask,
      `SELECT public.propose_change('create_entity',
         '{"type":"vessel","label":"Nayara"}'::jsonb, ARRAY[$1]::text[], NULL, NULL, '{}', NULL,
         false, $2::uuid) AS id`,
      [DOC, call],
    );
    return { job, call, claim };
  });
};

interface Reading {
  readonly claim?: string | null;
  readonly page?: number;
  readonly start?: number;
  readonly end?: number;
  readonly modality?: string;
  readonly adverse?: boolean | null;
  readonly key?: string;
}

const DOOR = `SELECT public.put_claim_reading(p_job => $1::uuid, p_claim => $2::uuid,
  p_text_extractor => $3, p_page => $4::int, p_start => $5::int, p_end => $6::int,
  p_modality => $7, p_adverse => $8::boolean, p_model_call => $9::uuid, p_input_form => 'text',
  p_reader_fingerprint => 'a-model abc', p_chunk_hash => $10, p_idempotency_key => $11) AS id`;

const putReading = (ask: Ask, seeded: Seeded, given: Reading = {}): Promise<string> =>
  asRole(ask, 'gabriel_agent', () =>
    idOf(ask, DOOR, [
      seeded.job,
      given.claim === undefined ? seeded.claim : given.claim,
      EXTRACTOR,
      given.page ?? 1,
      given.start ?? 11,
      given.end ?? 17,
      given.modality ?? 'asserts',
      given.adverse ?? null,
      seeded.call,
      SHA,
      given.key ?? 'd'.repeat(64),
    ]),
  );

const stored = z.array(
  z.object({
    reader_no: z.number(),
    reader_kind: z.string(),
    doc_id: z.string(),
    claim_id: z.uuid().nullable(),
    adverse: z.boolean(),
    start: z.number(),
    end: z.number(),
  }),
);

const READ = `SELECT reader_no, reader_kind, doc_id, claim_id, adverse, start, "end"
  FROM public.claim_reading WHERE id = $1`;

test('the door sets reader 1 from an extract_text job, and adverse is false when not set', async () => {
  const rows = await rolledBack('superuser', async (ask) => {
    const seeded = await seed(ask, 'extract_text');
    return { seeded, rows: stored.parse(await ask(READ, [await putReading(ask, seeded)])) };
  });
  expect(rows.rows).toStrictEqual([
    {
      reader_no: 1,
      reader_kind: 'llm',
      doc_id: DOC,
      claim_id: rows.seeded.claim,
      adverse: false,
      start: 11,
      end: 17,
    },
  ]);
});

test('the door stores adverse true when the reader sets it', async () => {
  const rows = await rolledBack('superuser', async (ask) => {
    const seeded = await seed(ask, 'extract_text');
    return stored.parse(await ask(READ, [await putReading(ask, seeded, { adverse: true })]));
  });
  expect(rows[0]?.adverse).toBe(true);
});

test('the door sets reader 2 from a second_read job, with no claim', async () => {
  const rows = await rolledBack('superuser', async (ask) => {
    const seeded = await seed(ask, 'second_read');
    return stored.parse(await ask(READ, [await putReading(ask, seeded, { claim: null })]));
  });
  expect(rows).toStrictEqual([expect.objectContaining({ reader_no: 2, claim_id: null })]);
});

test('the door returns the first row for a second write with the same key', async () => {
  const ids = await rolledBack('superuser', async (ask) => {
    const seeded = await seed(ask, 'extract_text');
    return [await putReading(ask, seeded), await putReading(ask, seeded)];
  });
  expect(ids[0]).toBe(ids[1]);
});

const REFUSALS: readonly (readonly [string, Reading, RegExp])[] = [
  ['a page that does not exist', { page: 9 }, /page 9 .*does not exist/u],
  ['an end past the page', { start: 40, end: 51 }, /outside page 1/u],
  ['a span that does not start before it ends', { start: 17, end: 17 }, /outside page 1/u],
  ['a modality outside the list', { modality: 'suggests' }, /modality/u],
  ['a first reading with no claim', { claim: null }, /names the proposal/u],
];

for (const [name, given, message] of REFUSALS)
  test(`the door refuses ${name}`, async () => {
    await expect(
      rolledBack('superuser', async (ask) =>
        putReading(ask, await seed(ask, 'extract_text'), given),
      ),
    ).rejects.toThrow(message);
  });

test('the door refuses a second reading that names a claim', async () => {
  await expect(
    rolledBack('superuser', async (ask) => putReading(ask, await seed(ask, 'second_read'))),
  ).rejects.toThrow(/second reader names no claim/u);
});

test('the door refuses a job that is not claimed', async () => {
  await expect(
    rolledBack('superuser', async (ask) => putReading(ask, await seed(ask, 'extract_text', false))),
  ).rejects.toThrow(/not running under this role/u);
});

test('the door refuses a job that another role holds', async () => {
  await expect(
    rolledBack('superuser', async (ask) => {
      const seeded = await seed(ask, 'extract_text');
      await ask("UPDATE public.jobs SET claimed_by = 'gabriel_app' WHERE id = $1", [seeded.job]);
      return putReading(ask, seeded);
    }),
  ).rejects.toThrow(/not running under this role/u);
});

test('the door refuses a job of a kind that reads no claim', async () => {
  await expect(
    rolledBack('superuser', async (ask) => putReading(ask, await seed(ask, 'map_structured'))),
  ).rejects.toThrow(/extract_text or second_read/u);
});

test('the door takes no reader number from the caller', async () => {
  await expect(
    rolledBack('superuser', async (ask) => {
      const seeded = await seed(ask, 'extract_text');
      return asRole(ask, 'gabriel_agent', () =>
        ask(DOOR.replace("p_input_form => 'text'", "p_input_form => 'text', p_reader_no => 1"), [
          seeded.job,
          seeded.claim,
          EXTRACTOR,
          1,
          11,
          17,
          'asserts',
          null,
          seeded.call,
          SHA,
          'd'.repeat(64),
        ]),
      );
    }),
  ).rejects.toMatchObject({ code: '42883' });
});

for (const write of [
  `INSERT INTO public.claim_reading (doc_id, text_extractor, page, start, "end", modality,
     reader_no, reader_kind, input_form, reader_fingerprint, job_id, chunk_hash, idempotency_key)
   VALUES ('${DOC}', '${EXTRACTOR}', 1, 0, 3, 'asserts', 1, 'parser', 'text', 'p', gen_random_uuid(),
     '${SHA}', '${SHA}')`,
  'UPDATE public.claim_reading SET adverse = true',
  'DELETE FROM public.claim_reading',
])
  test(`gabriel_agent cannot write the table directly: ${write.slice(0, 6)}`, async () => {
    await expect(rolledBack('agent', (ask) => ask(write))).rejects.toMatchObject({ code: '42501' });
  });

for (const [write, message] of [
  ['UPDATE public.claim_reading SET adverse = true WHERE id = $1', /never updated/u],
  ['DELETE FROM public.claim_reading WHERE id = $1', /never deleted/u],
] as const)
  test(`no role changes a reading: ${write.slice(0, 6)}`, async () => {
    await expect(
      rolledBack('superuser', async (ask) => {
        const id = await putReading(ask, await seed(ask, 'extract_text'));
        return ask(write, [id]);
      }),
    ).rejects.toThrow(message);
  });

// The owner writes these rows by hand, as the comparison will write its parser and OCR rows.
const ownerRow = (
  seeded: Seeded,
  row: { kind: string; readerNo: number; claim: string | null; call: string | null; key: string },
) => ({
  text: `INSERT INTO public.claim_reading (claim_id, doc_id, text_extractor, page, start, "end",
      modality, reader_no, reader_kind, model_call_id, input_form, reader_fingerprint, job_id,
      chunk_hash, idempotency_key)
    VALUES ($1, $2, $3, 1, 0, 3, 'asserts', $4, $5, $6, 'text', 'f', $7, $8, $9) RETURNING id`,
  values: [row.claim, DOC, EXTRACTOR, row.readerNo, row.kind, row.call, seeded.job, SHA, row.key],
});

test('the table refuses a model reading with no model call', async () => {
  await expect(
    rolledBack('superuser', async (ask) => {
      const seeded = await seed(ask, 'extract_text');
      const row = ownerRow(seeded, {
        kind: 'llm',
        readerNo: 1,
        claim: seeded.claim,
        call: null,
        key: 'e'.repeat(64),
      });
      return ask(row.text, row.values);
    }),
  ).rejects.toMatchObject({ code: '23514', constraint: 'claim_reading_llm_has_call' });
});

test('the table takes a parser row and an ocr row with no model call', async () => {
  const ids = await rolledBack('superuser', async (ask) => {
    const seeded = await seed(ask, 'extract_text');
    const made: string[] = [];
    for (const [kind, key] of [
      ['parser', 'e'.repeat(64)],
      ['ocr', 'f'.repeat(64)],
    ] as const) {
      const row = ownerRow(seeded, { kind, readerNo: 1, claim: seeded.claim, call: null, key });
      made.push(await idOf(ask, row.text, row.values));
    }
    return made;
  });
  expect(ids).toHaveLength(2);
});

test('the table takes a second model reading with no claim', async () => {
  const id = await rolledBack('superuser', async (ask) => {
    const seeded = await seed(ask, 'extract_text');
    const row = ownerRow(seeded, {
      kind: 'llm',
      readerNo: 2,
      claim: null,
      call: seeded.call,
      key: 'e'.repeat(64),
    });
    return idOf(ask, row.text, row.values);
  });
  expect(id).toMatch(/^[0-9a-f-]{36}$/u);
});

test('the table refuses two rows with the same key', async () => {
  await expect(
    rolledBack('superuser', async (ask) => {
      const seeded = await seed(ask, 'extract_text');
      const row = ownerRow(seeded, {
        kind: 'parser',
        readerNo: 1,
        claim: seeded.claim,
        call: null,
        key: 'e'.repeat(64),
      });
      await ask(row.text, row.values);
      return ask(row.text, row.values);
    }),
  ).rejects.toMatchObject({ code: '23505' });
});

for (const [write, message] of [
  ["UPDATE public.citation SET modality = 'denies' WHERE id = $1", /never updated/u],
  ['DELETE FROM public.citation WHERE id = $1', /never deleted/u],
] as const)
  test(`no role changes a citation: ${write.slice(0, 6)}`, async () => {
    await expect(
      rolledBack('superuser', async (ask) => {
        const seeded = await seed(ask, 'extract_text');
        const id = await idOf(
          ask,
          `INSERT INTO public.citation (claim_id, doc_id, page, start, "end", modality)
             VALUES ($1, $2, 1, 0, 3, 'asserts') RETURNING id`,
          [seeded.claim, DOC],
        );
        return ask(write, [id]);
      }),
    ).rejects.toThrow(message);
  });
