// The write-authorisation model, stated as privileges. Every sentence here was a hand check
// before it was a test.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe } from '../probe.ts';

const DOORS = {
  put_document: 'public.put_document(text,text,text,text,text,text,text,text,date)',
  propose_change: 'public.propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean)',
  promote_proposal: 'public.promote_proposal(uuid,text)',
  reject_proposal: 'public.reject_proposal(uuid,text)',
  claim_job: 'public.claim_job(text)',
} as const;

const holders = z.array(z.object({ door: z.string(), held: z.boolean() }));

const doorsHeldBy = async (identity: 'app' | 'agent'): Promise<Record<string, boolean>> => {
  const names = Object.keys(DOORS);
  const signatures = Object.values(DOORS);
  const rows = await probe(identity, async (ask) =>
    holders.parse(
      await ask(
        `SELECT d.door, has_function_privilege(d.signature, 'EXECUTE') AS held
           FROM unnest($1::text[], $2::text[]) AS d(door, signature)`,
        [names, signatures],
      ),
    ),
  );
  return Object.fromEntries(rows.map((row) => [row.door, row.held]));
};

// THE CLAIM DOOR IS HELD BY NOBODY. A claim moves a row to `running`, and no door moves one
// back, so the grant waits for the door that releases one. The role it waits for is written in
// the grants file: the worker that takes a job is the process that must propose as the machine.
test('gabriel_agent holds EXECUTE on propose_change and on no other door', async () => {
  expect(await doorsHeldBy('agent')).toStrictEqual({
    put_document: false,
    propose_change: true,
    promote_proposal: false,
    reject_proposal: false,
    claim_job: false,
  });
});

// THE CALL RUNS INSIDE A TRANSACTION THAT ROLLS BACK, and the reason is measured: this test was
// first written without one, the grant was still live, and the call it expected to fail took a
// row into `running` where no door reaches it. A test of a refusal must not act when it passes.
test('no role can call the claim door, so no row is taken before a release exists', async () => {
  for (const identity of ['app', 'agent'] as const)
    await expect(
      probe(identity, async (ask) => {
        await ask('BEGIN');
        try {
          return await ask("SELECT * FROM public.claim_job('a perimeter test')");
        } finally {
          await ask('ROLLBACK');
        }
      }),
    ).rejects.toMatchObject({ code: '42501' });
});

test('gabriel_app holds EXECUTE on the four acts of the operator, and never on the claim', async () => {
  expect(await doorsHeldBy('app')).toStrictEqual({
    put_document: true,
    propose_change: true,
    promote_proposal: true,
    reject_proposal: true,
    claim_job: false,
  });
});

const WRITES_OF = `
  SELECT g.table_schema || '.' || g.table_name || ' ' || g.privilege_type AS found
    FROM information_schema.role_table_grants g
   WHERE g.grantee = $1 AND g.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
   ORDER BY 1`;

const writes = z.array(z.object({ found: z.string() }));

test('gabriel_app writes no table, in any schema', async () => {
  const held = await probe('superuser', async (ask) =>
    writes.parse(await ask(WRITES_OF, ['gabriel_app'])).map((row) => row.found),
  );
  expect(held).toStrictEqual([]);
});

test('gabriel_agent writes no table, in any schema', async () => {
  const held = await probe('superuser', async (ask) =>
    writes.parse(await ask(WRITES_OF, ['gabriel_agent'])).map((row) => row.found),
  );
  expect(held).toStrictEqual([]);
});

// The claim is a door and not a table write. A worker that could mark a row by hand could also
// put it in a state no claim produced, and the count of the attempts would then prove nothing.
test('gabriel_agent cannot mark a job by hand', async () => {
  await expect(
    probe('agent', async (ask) => ask("UPDATE public.jobs SET status = 'running'")),
  ).rejects.toMatchObject({ code: '42501', message: 'permission denied for table jobs' });
});

test('gabriel_app cannot queue work without a document', async () => {
  await expect(
    probe('app', async (ask) => ask("INSERT INTO public.jobs (document_id) VALUES ('manual')")),
  ).rejects.toMatchObject({ code: '42501', message: 'permission denied for table jobs' });
});

const QUEUED = `SELECT count(*)::int AS n FROM public.jobs
   WHERE document_id = $1 AND status = 'queued' AND attempts = 0`;

const counted = z.array(z.object({ n: z.number().int() }));

const DOCUMENT = 'doc_perimeter_queue';

const PUT = `SELECT public.put_document($1, 'file', 'A perimeter test of the queue',
  NULL, NULL, NULL, NULL, NULL, '2026-09-02'::date) AS id`;

// The one way a job appears. The rollback proves the two writes are one act: the document row
// and the job row leave together, so neither can exist without the other.
test('the ingestion door queues the work in the transaction that writes the document', async () => {
  const inside = await probe('app', async (ask) => {
    await ask('BEGIN');
    try {
      await ask(PUT, [DOCUMENT]);
      return counted.parse(await ask(QUEUED, [DOCUMENT]));
    } finally {
      await ask('ROLLBACK');
    }
  });
  expect(inside).toStrictEqual([{ n: 1 }]);

  const after = await probe('app', async (ask) => counted.parse(await ask(QUEUED, [DOCUMENT])));
  expect(after).toStrictEqual([{ n: 0 }]);
});

const HAND_ENTERED = 'doc_perimeter_manual';

const PUT_MANUAL = `SELECT public.put_document($1, 'manual', 'A perimeter test of a hand entry')
  AS id`;

const ANY_JOB = 'SELECT count(*)::int AS n FROM public.jobs WHERE document_id = $1';

// A hand-entered source carries no file and no address, so an agent has nothing to read. The
// queue is the record of the work and not of the door, and this is the one row that proves it.
test('the ingestion door queues no work for a hand-entered source', async () => {
  const inside = await probe('app', async (ask) => {
    await ask('BEGIN');
    try {
      await ask(PUT_MANUAL, [HAND_ENTERED]);
      return counted.parse(await ask(ANY_JOB, [HAND_ENTERED]));
    } finally {
      await ask('ROLLBACK');
    }
  });
  expect(inside).toStrictEqual([{ n: 0 }]);
});

test('gabriel_read reads no table of public', async () => {
  await expect(
    probe('read', async (ask) => ask('SELECT count(*) FROM public.entities')),
  ).rejects.toMatchObject({ code: '42501', message: 'permission denied for schema public' });
});

const VERBS = [
  { verb: 'INSERT', sql: "INSERT INTO api.entity (label) VALUES ('a test')" },
  { verb: 'UPDATE', sql: "UPDATE api.entity SET label = 'a test'" },
  { verb: 'DELETE', sql: 'DELETE FROM api.entity' },
] as const;

for (const { verb, sql } of VERBS)
  test(`gabriel_read cannot ${verb} through an api view`, async () => {
    await expect(probe('read', async (ask) => ask(sql))).rejects.toMatchObject({
      code: '42501',
      message: 'permission denied for view entity',
    });
  });

const settings = z.array(z.object({ statement_timeout: z.string() }));

test('gabriel_read carries a five second statement timeout', async () => {
  const held = await probe('read', async (ask) =>
    settings.parse(await ask('SHOW statement_timeout')),
  );
  expect(held).toStrictEqual([{ statement_timeout: '5s' }]);
});

const CITES_MANUAL = `SELECT public.propose_change('create_entity',
  '{"type":"vessel","label":"A perimeter test"}'::jsonb, ARRAY['manual']::text[]) AS id`;

const made = z.array(z.object({ id: z.uuid() }));

// Every call below runs inside a transaction that rolls back, because the proposals ledger is
// append-only and a trigger refuses a delete.
const proposeCitingManual = async (identity: 'app' | 'agent'): Promise<readonly unknown[]> =>
  probe(identity, async (ask) => {
    await ask('BEGIN');
    try {
      return await ask(CITES_MANUAL);
    } finally {
      await ask('ROLLBACK');
    }
  });

test('a machine proposal that cites manual is refused', async () => {
  await expect(proposeCitingManual('agent')).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_machine_not_manual',
    message:
      'new row for relation "proposals" violates check constraint ' +
      '"proposals_machine_not_manual"',
  });
});

test('an operator proposal that cites manual is accepted', async () => {
  expect(made.parse(await proposeCitingManual('app'))).toHaveLength(1);
});
