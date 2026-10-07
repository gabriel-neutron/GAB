// A structured file is mapped by a proposal. The proposal names one document and no target, and its
// promotion writes nothing to the graph and queues the load. Each gesture runs inside a transaction
// that rolls back, so the census tests count the same rows.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const LIST = 'doc_map_list';
const SECOND = 'doc_map_second';
const ELSEWHERE = 'doc_map_elsewhere';
const UPLOADED = 'doc_map_uploaded';
const SIG = 'a'.repeat(64);
const SHA = 'c'.repeat(64);

const PUT_URL = `SELECT public.put_document($1, 'url', 'A test of the mapping',
  $2, $3, NULL, $4, 'text/csv', '2026-10-01'::date)`;

const PUT_FILE = `SELECT public.put_document($1, 'file', 'A test of the mapping',
  $2, NULL, NULL, $3, 'text/csv', '2026-10-01'::date)`;

const PAYLOAD = {
  table: 'list.csv',
  header_sig: SIG,
  modality: 'asserts',
  rows: {
    entity_type: 'vessel',
    label: 'Name',
    lookup: [{ key: 'imo', column: 'IMO' }],
    attrs: { imo: { column: 'IMO', cast: { type: 'identifier' } } },
  },
  relations: [],
};

const one = z.array(z.object({ id: z.string().min(1) })).length(1);

const idOf = async (ask: Ask, text: string, values: readonly unknown[] = []): Promise<string> => {
  const [row] = one.parse(await ask(text, values));
  if (row === undefined) throw new Error('no row came back');
  return row.id;
};

const asRole = async <T>(ask: Ask, role: string, work: () => Promise<T>): Promise<T> => {
  await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
  // No reset after a refusal: the transaction is then aborted, and the reset would hide the cause.
  const done = await work();
  await ask('RESET SESSION AUTHORIZATION');
  return done;
};

const seedDocuments = async (ask: Ask): Promise<void> => {
  await ask(PUT_URL, [LIST, 'raw/map-list.csv', 'https://www.lists.test/a.csv', 'd'.repeat(64)]);
  await ask(PUT_URL, [SECOND, 'raw/map-second.csv', 'https://lists.test/b.csv', 'e'.repeat(64)]);
  await ask(PUT_URL, [ELSEWHERE, 'raw/map-other.csv', 'https://other.test/c.csv', 'f'.repeat(64)]);
  await ask(PUT_FILE, [UPLOADED, 'raw/map-uploaded.csv', '1'.repeat(64)]);
};

const CALL = `SELECT public.record_model_call('mapper', 'v1', 'openrouter', 'a-model', $1, 10, 'ok',
  $2::uuid, 'a-model') AS id`;

const PROPOSE = 'SELECT public.propose_mapping($1, $2::jsonb, $3::uuid) AS id';

const OLDEST = "UPDATE public.jobs SET created_at = '1970-01-01' WHERE id = $1";

/** The map_structured job of a document, claimed by gabriel_agent. */
const runningMapJob = async (ask: Ask, document: string): Promise<string> => {
  const job = await idOf(ask, "SELECT public.enqueue_job($1, 'map_structured') AS id", [document]);
  await ask(OLDEST, [job]);
  await asRole(ask, 'gabriel_agent', () => ask('SELECT * FROM public.claim_job()'));
  return job;
};

const callOf = (ask: Ask, job: string | null): Promise<string> =>
  asRole(ask, 'gabriel_agent', () => idOf(ask, CALL, [SHA, job]));

const propose = async (
  ask: Ask,
  payload: unknown = PAYLOAD,
  document: string = LIST,
  held?: string,
): Promise<string> => {
  const job = held ?? (await runningMapJob(ask, document));
  const call = await callOf(ask, job);
  return asRole(ask, 'gabriel_agent', () =>
    idOf(ask, PROPOSE, [document, JSON.stringify(payload), call]),
  );
};

// An act is never decided by the transaction that proposed it, and each test runs in one
// transaction that rolls back. The test dates the proposal back with the freeze trigger off, as
// the test of a legacy act does, and the rollback turns the trigger on again.
const fromAnEarlierTransaction = async (ask: Ask, id: string): Promise<void> => {
  await ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only');
  await ask("UPDATE public.proposals SET xact = '1'::xid8 WHERE id = $1", [id]);
  await ask('ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_append_only');
};

const promote = (ask: Ask, id: string): Promise<string> =>
  asRole(ask, 'gabriel_app', () =>
    idOf(ask, "SELECT public.promote_proposal($1::uuid, 'a test') AS id", [id]),
  );

/** A map_document proposal for the list, accepted, with its load queued. */
const acceptedMapping = async (
  ask: Ask,
): Promise<{ mapping: string; job: string; map: string }> => {
  await seedDocuments(ask);
  const map = await runningMapJob(ask, LIST);
  const mapping = await propose(ask, PAYLOAD, LIST, map);
  await fromAnEarlierTransaction(ask, mapping);
  return { mapping, job: await promote(ask, mapping), map };
};

// ------------------------------------------------------- the shape of the act ---

test('a mapping names one document, no target and the call of its model', async () => {
  const stored = await rolledBack('superuser', async (ask) => {
    await seedDocuments(ask);
    const id = await propose(ask);
    return ask(
      `SELECT op, target_kind, src::text[] AS src, model_call_id IS NOT NULL AS called,
              author_role
         FROM public.proposals WHERE id = $1`,
      [id],
    );
  });
  expect(stored).toStrictEqual([
    {
      op: 'map_document',
      target_kind: null,
      src: [LIST],
      called: true,
      author_role: 'gabriel_agent',
    },
  ]);
});

test('a second proposal of the same mapping returns the one that waits', async () => {
  const [first, second] = await rolledBack('superuser', async (ask) => {
    await seedDocuments(ask);
    const call = await callOf(ask, await runningMapJob(ask, LIST));
    const door = (): Promise<string> =>
      asRole(ask, 'gabriel_agent', () => idOf(ask, PROPOSE, [LIST, JSON.stringify(PAYLOAD), call]));
    return [await door(), await door()];
  });
  expect(second).toBe(first);
});

const REFUSED_SHAPES: readonly (readonly [string, unknown])[] = [
  ['an attribute object at the top', { ...PAYLOAD, attrs: {} }],
  ['a signature that is not a digest', { ...PAYLOAD, header_sig: 'abc' }],
  ['a modality outside the list', { ...PAYLOAD, modality: 'suggests' }],
  ['no relations', { ...PAYLOAD, relations: undefined }],
  ['a key that the act does not know', { ...PAYLOAD, expression: 'a + b' }],
];

for (const [name, payload] of REFUSED_SHAPES)
  test(`the door refuses a mapping with ${name}, and names the field to correct`, async () => {
    const refusal = rolledBack('superuser', async (ask) => {
      await seedDocuments(ask);
      return propose(ask, payload);
    });
    await expect(refusal).rejects.toMatchObject({
      code: '23514',
      constraint: 'proposals_map_document_shape',
      hint: 'mapping',
    });
    await expect(refusal).rejects.toThrow(/^a mapping names one document/u);
  });

test('the door refuses a call of another job, and a call of no job', async () => {
  for (const other of ['another document', 'no job'] as const)
    await expect(
      rolledBack('superuser', async (ask) => {
        await seedDocuments(ask);
        await runningMapJob(ask, LIST);
        const stray =
          other === 'no job'
            ? await callOf(ask, null)
            : await callOf(ask, await runningMapJob(ask, SECOND));
        return asRole(ask, 'gabriel_agent', () =>
          idOf(ask, PROPOSE, [LIST, JSON.stringify(PAYLOAD), stray]),
        );
      }),
    ).rejects.toThrow(/the call of a mapping belongs to the map_structured job of the document/u);
});

test('the operator door refuses a mapping, because only a model makes one', async () => {
  await expect(
    rolledBack('superuser', async (ask) => {
      await seedDocuments(ask);
      await asRole(ask, 'gabriel_app', () =>
        ask(`SELECT public.propose_change('map_document', $1::jsonb, ARRAY[$2]::text[])`, [
          JSON.stringify(PAYLOAD),
          LIST,
        ]),
      );
    }),
  ).rejects.toMatchObject({ code: '23514', constraint: 'proposals_map_document_shape' });
});

// ------------------------------------------------------- the promotion ---

const COUNTS = `SELECT (SELECT count(*) FROM public.entities)::int AS entities,
  (SELECT count(*) FROM public.relations)::int AS relations`;

const queued = z.array(
  z.object({ kind: z.string(), status: z.string(), mapping: z.uuid(), document_id: z.string() }),
);

test('the promotion of a mapping writes nothing to the graph and queues one load_mapped job', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await seedDocuments(ask);
    const mapping = await propose(ask);
    await fromAnEarlierTransaction(ask, mapping);
    const before = await ask(COUNTS);
    const job = await promote(ask, mapping);
    return {
      mapping,
      before,
      after: await ask(COUNTS),
      job: queued.parse(
        await ask('SELECT kind, status, mapping, document_id FROM public.jobs WHERE id = $1', [
          job,
        ]),
      ),
      status: await ask('SELECT status FROM public.proposals WHERE id = $1', [mapping]),
    };
  });
  expect(seen.after).toStrictEqual(seen.before);
  expect(seen.job).toStrictEqual([
    { kind: 'load_mapped', status: 'queued', mapping: seen.mapping, document_id: LIST },
  ]);
  expect(seen.status).toStrictEqual([{ status: 'accepted' }]);
});

test('the promotion refuses a mapping while a load of its document is open, in words', async () => {
  const refusal = rolledBack('superuser', async (ask) => {
    const { map } = await acceptedMapping(ask);
    const second = await propose(ask, { ...PAYLOAD, table: 'second sheet' }, LIST, map);
    await fromAnEarlierTransaction(ask, second);
    return promote(ask, second);
  });
  await expect(refusal).rejects.toThrow(/has a load that is queued or runs already/u);
  await expect(refusal).rejects.not.toMatchObject({ code: '23505' });
});

test('the table refuses a load_mapped job with no mapping, and a mapping on another kind', async () => {
  for (const [kind, mapping] of [
    ['load_mapped', false],
    ['extract_text', true],
  ] as const)
    await expect(
      rolledBack('superuser', async (ask) => {
        const { mapping: id } = await acceptedMapping(ask);
        await ask(
          `INSERT INTO public.jobs (document_id, kind, mapping) VALUES ($1, $2, $3::uuid)`,
          [SECOND, kind, mapping ? id : null],
        );
      }),
    ).rejects.toMatchObject({ code: '23514', constraint: 'jobs_mapping_kind' });
});

test('enqueue_job does not queue a load_mapped job', async () => {
  await expect(
    rolledBack('superuser', async (ask) => {
      await seedDocuments(ask);
      await asRole(ask, 'gabriel_agent', () =>
        ask("SELECT public.enqueue_job($1, 'load_mapped')", [LIST]),
      );
    }),
  ).rejects.toMatchObject({ code: '22023' });
});

const claimed = z.array(
  z.object({ job_id: z.uuid(), job_kind: z.string(), job_mapping: z.uuid().nullable() }),
);

test('the claim takes a load_mapped job and gives its mapping', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    const held = await acceptedMapping(ask);
    await ask("UPDATE public.jobs SET created_at = '1970-01-01' WHERE id = $1", [held.job]);
    return {
      held,
      rows: claimed.parse(
        await asRole(ask, 'gabriel_agent', () =>
          ask('SELECT job_id, job_kind, job_mapping FROM public.claim_job()'),
        ),
      ),
    };
  });
  expect(seen.rows).toStrictEqual([
    { job_id: seen.held.job, job_kind: 'load_mapped', job_mapping: seen.held.mapping },
  ]);
});

// ------------------------------------------------------- the reuse door ---

const ENQUEUE = 'SELECT public.enqueue_mapped_load($1, $2) AS id';

test('enqueue_mapped_load queues the load of a second file of the same host and header', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    const { mapping } = await acceptedMapping(ask);
    await runningMapJob(ask, SECOND);
    const job = await asRole(ask, 'gabriel_agent', () => idOf(ask, ENQUEUE, [SECOND, SIG]));
    return {
      mapping,
      rows: queued.parse(
        await ask('SELECT kind, status, mapping, document_id FROM public.jobs WHERE id = $1', [
          job,
        ]),
      ),
    };
  });
  expect(seen.rows).toStrictEqual([
    { kind: 'load_mapped', status: 'queued', mapping: seen.mapping, document_id: SECOND },
  ]);
});

test('enqueue_mapped_load returns the open load of a document, and queues no second one', async () => {
  const [first, second] = await rolledBack('superuser', async (ask) => {
    await acceptedMapping(ask);
    await runningMapJob(ask, SECOND);
    const door = (): Promise<string> =>
      asRole(ask, 'gabriel_agent', () => idOf(ask, ENQUEUE, [SECOND, SIG]));
    return [await door(), await door()];
  });
  expect(second).toBe(first);
});

const NO_REUSE: readonly (readonly [string, string, string, boolean])[] = [
  ['another host', ELSEWHERE, SIG, true],
  ['a file with no address', UPLOADED, SIG, true],
  ['another header', SECOND, '9'.repeat(64), true],
  ['a mapping that is not accepted', SECOND, SIG, false],
];

for (const [name, document, sig, accepted] of NO_REUSE)
  test(`enqueue_mapped_load finds no mapping for ${name}`, async () => {
    const found = await rolledBack('superuser', async (ask) => {
      await seedDocuments(ask);
      const mapping = await propose(ask);
      if (accepted) {
        await fromAnEarlierTransaction(ask, mapping);
        await promote(ask, mapping);
      }
      await runningMapJob(ask, document);
      return asRole(ask, 'gabriel_agent', () => ask(ENQUEUE, [document, sig]));
    });
    expect(found).toStrictEqual([{ id: null }]);
  });

const REFUSED_REUSE: readonly (readonly [string, string, RegExp])[] = [
  ['a header signature that is not a digest', 'abc', /64 hexadecimal characters/u],
  ['a header signature that is absent', '', /64 hexadecimal characters/u],
];

for (const [name, sig, message] of REFUSED_REUSE)
  test(`enqueue_mapped_load refuses ${name}`, async () => {
    await expect(
      rolledBack('superuser', async (ask) => {
        await seedDocuments(ask);
        await runningMapJob(ask, SECOND);
        return asRole(ask, 'gabriel_agent', () => ask(ENQUEUE, [SECOND, sig]));
      }),
    ).rejects.toThrow(message);
  });

test('enqueue_mapped_load refuses a document that the caller holds no mapping job for', async () => {
  await expect(
    rolledBack('superuser', async (ask) => {
      await acceptedMapping(ask);
      return asRole(ask, 'gabriel_agent', () => ask(ENQUEUE, [SECOND, SIG]));
    }),
  ).rejects.toThrow(/running map_structured job of document doc_map_second/u);
});

// ------------------------------------------------------- the report door ---

const REPORT = `SELECT public.put_load_report($1::uuid, 'The load report', $3, $2,
  'text/csv')::text AS id`;

const keyOf = (sha: string): string => `raw/${sha}`;

/** The load of the list, claimed by gabriel_agent. */
const claimedLoad = async (ask: Ask): Promise<{ mapping: string; job: string }> => {
  const held = await acceptedMapping(ask);
  await ask("UPDATE public.jobs SET created_at = '1970-01-01' WHERE id = $1", [held.job]);
  await asRole(ask, 'gabriel_agent', () => ask('SELECT * FROM public.claim_job()'));
  return held;
};

const reportRow = z.array(
  z.object({ kind: z.string(), sha256: z.string(), retrieved: z.boolean() }),
);

test('put_load_report stores one report for a held load, and the same bytes return the same row', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    const { job } = await claimedLoad(ask);
    const first = await asRole(ask, 'gabriel_agent', () =>
      idOf(ask, REPORT, [job, SHA, keyOf(SHA)]),
    );
    const second = await asRole(ask, 'gabriel_agent', () =>
      idOf(ask, REPORT, [job, SHA, keyOf(SHA)]),
    );
    return {
      first,
      second,
      row: reportRow.parse(
        await ask(
          `SELECT kind, sha256, retrieved_at = current_date AS retrieved
             FROM public.documents WHERE id = $1`,
          [first],
        ),
      ),
    };
  });
  expect(seen.second).toBe(seen.first);
  expect(seen.row).toStrictEqual([{ kind: 'report', sha256: SHA, retrieved: true }]);
});

test('put_load_report refuses bytes that a document of another kind holds', async () => {
  await expect(
    rolledBack('superuser', async (ask) => {
      const { job } = await claimedLoad(ask);
      return asRole(ask, 'gabriel_agent', () =>
        idOf(ask, REPORT, [job, 'd'.repeat(64), keyOf('d'.repeat(64))]),
      );
    }),
  ).rejects.toThrow(/doc_map_list of kind url, and not a report/u);
});

test('put_load_report refuses a load that the caller does not hold', async () => {
  await expect(
    rolledBack('superuser', async (ask) => {
      const { job } = await acceptedMapping(ask);
      return asRole(ask, 'gabriel_agent', () => idOf(ask, REPORT, [job, SHA, keyOf(SHA)]));
    }),
  ).rejects.toMatchObject({ code: '22023' });
});

test('put_load_report refuses a key that is not the hash of the bytes', async () => {
  await expect(
    rolledBack('superuser', async (ask) => {
      const { job } = await claimedLoad(ask);
      return asRole(ask, 'gabriel_agent', () => idOf(ask, REPORT, [job, SHA, 'raw/report.csv']));
    }),
  ).rejects.toThrow(/the key of a load report is raw\/ and the hash of its bytes/u);
});

test('put_load_report refuses a job of another kind', async () => {
  await expect(
    rolledBack('superuser', async (ask) => {
      await seedDocuments(ask);
      const job = await idOf(ask, "SELECT public.enqueue_job($1, 'extract_text') AS id", [LIST]);
      await ask("UPDATE public.jobs SET created_at = '1970-01-01' WHERE id = $1", [job]);
      await asRole(ask, 'gabriel_agent', () => ask('SELECT * FROM public.claim_job()'));
      return asRole(ask, 'gabriel_agent', () => idOf(ask, REPORT, [job, SHA, keyOf(SHA)]));
    }),
  ).rejects.toThrow(/load_mapped/u);
});
