// Migration 0041 drops the reading table and the key of a proposal. It keeps each first reading
// as a citation, and it stops before its first change when the database holds data that a
// citation cannot keep. Each case puts the test database back in the state before 0041, inside a
// transaction that always rolls back, and runs the file.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const MIGRATION = join(import.meta.dirname, '..', 'db', 'migrations', '0041_one_propose_path.sql');

const DOC = 'doc_migration_0041';
const EXTRACTOR = 'migration-0041@1';

// The columns of 0036 that the migration reads, and the shape of 0032. The constraint and the
// index carry the names that the migration drops.
const BEFORE_0041 = `
  SET LOCAL ROLE gabriel_owner;
  ALTER TABLE citation DISABLE TRIGGER citation_append_only;
  DELETE FROM citation;
  ALTER TABLE citation ENABLE ALWAYS TRIGGER citation_append_only;
  ALTER TABLE citation DROP COLUMN text_extractor;
  ALTER TABLE proposals DROP COLUMN act_digest, DROP COLUMN originator;
  ALTER TABLE proposals ADD COLUMN idempotency_key text,
    ADD CONSTRAINT proposals_key_is_machine CHECK (true);
  CREATE UNIQUE INDEX proposals_idempotency_key_uidx
    ON proposals (idempotency_key) WHERE idempotency_key IS NOT NULL;
  CREATE TABLE claim_reading (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id       uuid,
    doc_id         doc_id NOT NULL,
    text_extractor text NOT NULL,
    page           int NOT NULL,
    start          int NOT NULL,
    "end"          int NOT NULL,
    modality       text NOT NULL,
    adverse        boolean NOT NULL DEFAULT false,
    reader_no      smallint NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now());
  RESET ROLE`;

const made = z.array(z.object({ id: z.uuid() }));

// Departure: the files of this project run at the same time, and the migration changes two
// tables that they write. The test takes every lock it needs first, with a short wait, so it
// never holds one lock while it waits for another. A wait that ends runs the case again.
const LOCKS = `LOCK TABLE public.proposals, public.citation, public.document_text,
  public.documents IN ACCESS EXCLUSIVE MODE`;

const LOCK_TIMEOUT = '55P03';

const alone = async <T>(work: (ask: Ask) => Promise<T>): Promise<T> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await rolledBack('superuser', async (ask) => {
        await ask("SET LOCAL lock_timeout = '200ms'");
        await ask(LOCKS);
        await ask('SET LOCAL lock_timeout = 0');
        return work(ask);
      });
    } catch (cause) {
      const waited = cause instanceof Error && 'code' in cause && cause.code === LOCK_TIMEOUT;
      if (!waited || attempt === 50) throw cause;
    }
  }
};

// One pending act of the operator that cites the test document, and the page of that document.
const seed = async (ask: Ask): Promise<string> => {
  await ask(
    `INSERT INTO public.documents (id, kind, title) VALUES ($1, 'url', 'A migration test')`,
    [DOC],
  );
  await ask(
    `INSERT INTO public.document_text (document_id, extractor, page, text)
       VALUES ($1, $2, 1, 'The tanker Nayara left Sikka.')`,
    [DOC, EXTRACTOR],
  );
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const [act] = made.parse(
    await ask(
      `SELECT public.propose_change('create_entity',
         '{"type":"vessel","label":"Nayara"}'::jsonb, ARRAY[$1]::text[]) AS id`,
      [DOC],
    ),
  );
  await ask('RESET SESSION AUTHORIZATION');
  if (act === undefined) throw new Error('the door wrote no act');
  await ask(BEFORE_0041);
  return act.id;
};

const READ = `INSERT INTO claim_reading
  (claim_id, doc_id, text_extractor, page, start, "end", modality, adverse, reader_no)
  VALUES ($1, $2, $3, 1, 11, 17, 'asserts', $4, $5)`;

const migrate = async (ask: Ask): Promise<void> => {
  await ask(await readFile(MIGRATION, 'utf8'));
};

const citations = z.array(z.object({ start: z.number(), end: z.number(), extractor: z.string() }));

const after = async (ask: Ask) => ({
  reading: await ask(`SELECT to_regclass('public.claim_reading') AS present`),
  cited: citations.parse(
    await ask(
      `SELECT start, "end" AS end, text_extractor AS extractor FROM public.citation
        WHERE doc_id = $1`,
      [DOC],
    ),
  ),
});

test('the migration runs on an empty reading table', async () => {
  const found = await alone(async (ask) => {
    await seed(ask);
    await migrate(ask);
    return after(ask);
  });
  expect(found).toStrictEqual({ reading: [{ present: null }], cited: [] });
});

test('the migration keeps each first reading as a citation', async () => {
  const found = await alone(async (ask) => {
    const act = await seed(ask);
    await ask(READ, [act, DOC, EXTRACTOR, false, 1]);
    await migrate(ask);
    return after(ask);
  });
  expect(found).toStrictEqual({
    reading: [{ present: null }],
    cited: [{ start: 11, end: 17, extractor: EXTRACTOR }],
  });
});

const STOPPED = /^Migration 0041 stopped and changed nothing\. .*The operator must decide/u;

test.each([
  ['a reading of the second reader', [null, false, 2]],
  ['a first reading that names no proposal', [null, false, 1]],
  ['an adverse reading', ['act', true, 1]],
] as const)('the migration stops on %s, and drops nothing', async (_, [claim, adverse, reader]) => {
  await expect(
    alone(async (ask) => {
      const act = await seed(ask);
      await ask(READ, [claim === 'act' ? act : null, DOC, EXTRACTOR, adverse, reader]);
      await migrate(ask);
    }),
  ).rejects.toMatchObject({ code: '55000', message: expect.stringMatching(STOPPED) as string });
});

test('the migration stops on a pending act that holds a key, and drops nothing', async () => {
  await expect(
    alone(async (ask) => {
      const act = await seed(ask);
      await ask('SET LOCAL ROLE gabriel_owner');
      await ask('ALTER TABLE proposals DISABLE TRIGGER proposals_append_only');
      await ask(`UPDATE proposals SET idempotency_key = $2 WHERE id = $1`, [act, 'a'.repeat(64)]);
      await ask('RESET ROLE');
      await migrate(ask);
    }),
  ).rejects.toMatchObject({
    code: '55000',
    message: expect.stringMatching(/ 1 pending proposals with an idempotency key\./u) as string,
  });
});
