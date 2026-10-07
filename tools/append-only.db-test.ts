// The owner and the superuser ignore every grant, so for them this trigger is the only guard of
// the published ledger. Each gesture below is theirs, and each one rolls back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const made = z.array(z.object({ id: z.uuid() }));

const PROPOSE = `SELECT public.propose_change('create_entity',
  '{"type":"vessel","label":"An append-only test"}'::jsonb, ARRAY['manual']::text[]) AS id`;

// The trigger that stamps the author refuses every session role except the two writers.
const pendingAct = async (ask: Ask): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const [row] = made.parse(await ask(PROPOSE));
  await ask('RESET SESSION AUTHORIZATION');
  if (row === undefined) throw new Error('the proposal was not written');
  return row.id;
};

const REJECT = `UPDATE public.proposals
  SET status = 'rejected', decided_at = now(), decided_by = 'a test', reject_reason = 'duplicate'
  WHERE id = $1::uuid`;

/** One gesture of the superuser on one proposal, inside a transaction that always rolls back. */
const onAct = (decided: boolean, text: string): Promise<unknown> =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      const id = await pendingAct(ask);
      if (decided) await ask(REJECT, [id]);
      return await ask(text, [id]);
    } finally {
      await ask('ROLLBACK');
    }
  });

test('a proposal is never deleted', async () => {
  await expect(onAct(false, 'DELETE FROM public.proposals WHERE id = $1::uuid')).rejects.toThrow(
    /^a proposal is never deleted\. It is the record of what was set aside$/,
  );
});

test('a pending proposal never takes the pending status again', async () => {
  await expect(
    onAct(false, `UPDATE public.proposals SET status = 'pending' WHERE id = $1::uuid`),
  ).rejects.toThrow(/^a proposal leaves pending and never returns to it$/);
});

test('a decision does not change the payload of the act', async () => {
  await expect(
    onAct(
      false,
      `UPDATE public.proposals SET status = 'rejected', decided_at = now(), decided_by = 'a test',
         reject_reason = 'duplicate',
         payload = '{"type":"vessel","label":"A rewritten label"}'::jsonb WHERE id = $1::uuid`,
    ),
  ).rejects.toThrow(/^a proposal is frozen at the insert$/);
});

test('a decided proposal takes no second decision', async () => {
  await expect(
    onAct(true, `UPDATE public.proposals SET status = 'accepted' WHERE id = $1::uuid`),
  ).rejects.toThrow(/^proposal [0-9a-f-]{36} is already rejected, and a decided act is frozen$/);
});

// The one gesture that must pass: without it, a trigger that refuses every update passes above.
test('a pending proposal takes its decision', async () => {
  await expect(
    onAct(true, 'SELECT status FROM public.proposals WHERE id = $1::uuid'),
  ).resolves.toStrictEqual([{ status: 'rejected' }]);
});

test('a rejection with no reason is refused', async () => {
  await expect(
    onAct(
      false,
      `UPDATE public.proposals SET status = 'rejected', decided_at = now(), decided_by = 'a test'
        WHERE id = $1::uuid`,
    ),
  ).rejects.toThrow(/^a rejection names one reason$/);
});

test('a promotion writes no reason of a rejection', async () => {
  await expect(
    onAct(
      false,
      `UPDATE public.proposals SET status = 'accepted', decided_at = now(), decided_by = 'a test',
         reject_note = 'a note' WHERE id = $1::uuid`,
    ),
  ).rejects.toThrow(/^only a rejection writes a reason and a note$/);
});

test('the reason of a rejection is frozen with the decision', async () => {
  await expect(
    onAct(true, `UPDATE public.proposals SET reject_reason = 'other' WHERE id = $1::uuid`),
  ).rejects.toThrow(/^proposal [0-9a-f-]{36} is already rejected, and a decided act is frozen$/);
});
