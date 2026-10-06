// The public read role sees the record and the candidate layer, and nothing else. A rejected act
// was never admitted to the record, a job is work of the operator, and a model call holds the
// digest of a prompt, so none of them is public. A pending act is the candidate layer, which the
// app publishes with a label. The roles that run a tool still read every act, because the
// candidate layer is their work.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../probe.ts';

const shown = z.array(z.object({ status: z.string(), payload: z.unknown() }));

const PAYLOAD = '{"type":"vessel","label":"A payload that stays private"}';

const ACT = z.json().parse(JSON.parse(PAYLOAD));

// External constraint: the trigger that stamps the author refuses each role but the two writers.
const asApp = async (ask: Ask, text: string, values: readonly unknown[] = []) => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  try {
    return await ask(text, values);
  } finally {
    await ask('RESET SESSION AUTHORIZATION');
  }
};

const decided = async (ask: Ask, decision: 'pending' | 'rejected'): Promise<string> => {
  const [made] = z
    .array(z.object({ id: z.uuid() }))
    .parse(
      await asApp(
        ask,
        `SELECT public.propose_change('create_entity', $1::jsonb, ARRAY['manual']::text[]) AS id`,
        [PAYLOAD],
      ),
    );
  if (made === undefined) throw new Error('the act was not written');
  if (decision === 'rejected')
    await asApp(ask, `SELECT public.reject_proposal($1::uuid, 'a test rejection')`, [made.id]);
  return made.id;
};

const readAs = async (ask: Ask, role: string, id: string) => {
  await ask(`SET LOCAL ROLE ${role}`);
  try {
    return shown.parse(await ask('SELECT status, payload FROM api.proposal WHERE id = $1', [id]));
  } finally {
    await ask('RESET ROLE');
  }
};

test('the public read role sees no rejected act', async () => {
  const rows = await rolledBack('superuser', async (ask) =>
    readAs(ask, 'gabriel_read', await decided(ask, 'rejected')),
  );
  expect(rows).toStrictEqual([]);
});

test('the public read role sees a pending act, because the candidate layer is public', async () => {
  const rows = await rolledBack('superuser', async (ask) =>
    readAs(ask, 'gabriel_read', await decided(ask, 'pending')),
  );
  expect(rows).toStrictEqual([{ status: 'pending', payload: ACT }]);
});

for (const decision of ['pending', 'rejected'] as const)
  test(`a tool role still reads the payload of a ${decision} act`, async () => {
    const rows = await rolledBack('superuser', async (ask) =>
      readAs(ask, 'gabriel_agent', await decided(ask, decision)),
    );
    expect(rows).toStrictEqual([{ status: decision, payload: ACT }]);
  });

// A view that does not exist and a view with no grant are both closed, so either code passes.
for (const view of ['job', 'model_call'] as const)
  test(`the public read role cannot read api.${view}`, async () => {
    await expect(
      rolledBack('read', (ask) => ask(`SELECT 1 FROM api.${view}`)),
    ).rejects.toHaveProperty('code', expect.stringMatching(/^(42501|42P01)$/u));
  });

// The reason of a dispute quotes the checker beside a private passage. No view of the read API
// holds it, and the table itself is closed to the public read role.
test('the public read role cannot read why an act is disputed', async () => {
  await expect(
    rolledBack('read', (ask) => ask('SELECT dissent_reason FROM api.proposal')),
  ).rejects.toHaveProperty('code', '42703');
  await expect(
    rolledBack('read', (ask) => ask('SELECT dissent_reason FROM public.proposals')),
  ).rejects.toHaveProperty('code', '42501');
});
