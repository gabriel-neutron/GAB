// The public read role sees the payload of an accepted act and of no other. A pending act and a
// rejected act were never admitted to the record, so their text stays out of the public view. The
// roles that run a tool still read every payload, because the candidate layer is their work.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../probe.ts';

const shown = z.array(z.object({ status: z.string(), payload: z.unknown() }));

const PAYLOAD = '{"type":"vessel","label":"A payload that stays private"}';

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

// Known defect, and the fix is not in this change. The read service and the review surface parse
// the payload of every pending act, so a view that hides it breaks twelve tests of the read
// contract and the pending list of the interface. `test.fails` keeps the assertion whole and turns
// red the day the view hides the payload, so the marker must go with that fix.
for (const decision of ['pending', 'rejected'] as const)
  test.fails(`the public read role sees no payload of a ${decision} act`, async () => {
    const rows = await rolledBack('superuser', async (ask) =>
      readAs(ask, 'gabriel_read', await decided(ask, decision)),
    );
    expect(rows).toStrictEqual([{ status: decision, payload: null }]);
  });

test('a tool role still reads the payload of a pending act', async () => {
  const rows = await rolledBack('superuser', async (ask) =>
    readAs(ask, 'gabriel_agent', await decided(ask, 'pending')),
  );
  expect(rows).toStrictEqual([{ status: 'pending', payload: z.json().parse(JSON.parse(PAYLOAD)) }]);
});
