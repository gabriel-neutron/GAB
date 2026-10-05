// A red team of the public read, with invented fixtures only. ADR 0011 section 9 says that a
// claim in HELD or REJECTED is not shown, and PU1 says that GAB shows no personal data of a natural
// person that a cited source does not publish. The public role reads through `api`. Each test
// writes an act that carries untrusted text, then reads as the public role. Each rolls back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const CITED = 'doc_8f2a41';

// Invented values. None is a real person, address, number or link.
const ADDRESS = '12 Fictional Lane, Testville 00000';
const PHONE = '+00 555 0100';
const LINK = 'https://third-party.example.test/profile/zz-invented';

const made = z.array(z.object({ id: z.uuid() }));
const seen = z.array(z.object({ payload: z.unknown(), status: z.string() }));

const PROPOSE = `SELECT public.propose_change('create_entity',
  jsonb_build_object('type', 'person', 'label', 'An invented third party',
    'attrs', jsonb_build_object(
      'home_address', jsonb_build_object('v', $2::text, 'src', jsonb_build_array($1::text)),
      'phone', jsonb_build_object('v', $3::text, 'src', jsonb_build_array($1::text)),
      'profile', jsonb_build_object('v', $4::text, 'src', jsonb_build_array($1::text)))),
  ARRAY[$1::text]) AS id`;

const REJECT = `UPDATE public.proposals
  SET status = 'rejected', decided_at = now(), decided_by = 'a test' WHERE id = $1::uuid`;

const READ = 'SELECT payload, status FROM api.proposal WHERE id = $1::uuid';

const asApp = async (ask: Ask): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const [row] = made.parse(await ask(PROPOSE, [CITED, ADDRESS, PHONE, LINK]));
  await ask('RESET SESSION AUTHORIZATION');
  if (row === undefined) throw new Error('the door returned no row');
  return row.id;
};

const publicRead = async (ask: Ask, id: string): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_read');
  const rows = seen.parse(await ask(READ, [id]));
  await ask('RESET SESSION AUTHORIZATION');
  return JSON.stringify(rows);
};

const rolledBack = <T>(work: (ask: Ask) => Promise<T>): Promise<T> =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      return await work(ask);
    } finally {
      await ask('ROLLBACK');
    }
  });

// THE TWO TESTS BELOW ARE EXPECTED TO FAIL TODAY. `api.proposal` publishes the payload of every
// act in every status, and the detail page reads pending acts through that view. A fix removes the
// payload of a pending and of a rejected act from the public view, and it moves the draft read to
// an operator role. That choice changes the read contract, so the operator makes it. `test.fails`
// keeps staging green, and it turns red on the day the view closes, when the marker must go.

// Attack: a reply or a page carries a third-party home address, a phone and a link. An agent
// proposes them as attributes. The act is still pending, and nobody has decided it.
test.fails('the public role reads no personal field of a pending act', async () => {
  const shown = await rolledBack(async (ask) => publicRead(ask, await asApp(ask)));
  for (const secret of [ADDRESS, PHONE, LINK]) expect(shown).not.toContain(secret);
});

// Attack: the operator rejects the act. ADR 0011 section 9 shows a REJECTED claim to nobody.
test.fails('the public role reads no personal field of a rejected act', async () => {
  const shown = await rolledBack(async (ask) => {
    const id = await asApp(ask);
    await ask(REJECT, [id]);
    return publicRead(ask, id);
  });
  for (const secret of [ADDRESS, PHONE, LINK]) expect(shown).not.toContain(secret);
});

// Guard: the model call table publishes a digest of a prompt, and a prompt quotes untrusted text.
// A new column that can hold text would open the same hole, so the list of columns is closed.
test('the public model call view has no column that can hold a prompt or a reply', async () => {
  const columns = z.array(z.object({ column_name: z.string() }));
  const found = await probe('superuser', async (ask) =>
    columns.parse(
      await ask(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'api' AND table_name = 'model_call' ORDER BY column_name`,
      ),
    ),
  );
  expect(found.map((c) => c.column_name)).toStrictEqual([
    'agent',
    'agent_version',
    'created_at',
    'endpoint',
    'id',
    'input_tokens',
    'job_id',
    'latency_ms',
    'outcome',
    'output_tokens',
    'prompt_sha256',
    'requested_model',
    'served_model',
  ]);
});

// Guard: the object key of a stored file is not a public column.
test('the public document view shows no object key', async () => {
  const columns = z.array(z.object({ column_name: z.string() }));
  const found = await probe('superuser', async (ask) =>
    columns.parse(
      await ask(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'api' AND table_name = 'document'`,
      ),
    ),
  );
  expect(found.map((c) => c.column_name)).not.toContain('s3_key');
});
