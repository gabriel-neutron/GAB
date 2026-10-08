// The job that rates a new author, and the approval of the reference set. Each case runs inside a
// transaction that rolls back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import {
  approve,
  as,
  cited,
  join,
  label,
  refusal,
  reference,
  storeUnapproved,
} from './author-fixture.ts';
import { rolledBack, type Ask } from './probe.ts';

const letterOf = async (ask: Ask, name: string): Promise<string | undefined> =>
  z
    .array(z.object({ letter: z.string() }))
    .parse(
      await as(ask, 'gabriel_app', () =>
        ask('SELECT public.letter_of($1)::text AS letter', [name]),
      ),
    )[0]?.letter;

const jobsOf = async (ask: Ask, name: string): Promise<readonly string[]> =>
  z
    .array(z.object({ status: z.string() }))
    .parse(
      await ask(`SELECT status FROM public.jobs WHERE kind = 'rate_author' AND author = $1`, [
        name,
      ]),
    )
    .map((row) => row.status);

const contextOf = async (ask: Ask, name: string): Promise<unknown> =>
  z
    .array(z.object({ context: z.unknown() }))
    .parse(
      await as(ask, 'gabriel_agent', () =>
        ask('SELECT public.rating_context($1) AS context', [name]),
      ),
    )[0]?.context;

test('a reference author is no author until the operator approves the set', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await storeUnapproved(ask, 'Official Registry', 'A');
    const before = {
      letter: await letterOf(ask, 'official registry'),
      context: await contextOf(ask, 'someone new'),
      join: await refusal(ask, () => join(ask, 'The Registry', 'Official Registry')),
    };
    await approve(ask);
    return {
      before,
      after: {
        letter: await letterOf(ask, 'official registry'),
        context: await contextOf(ask, 'someone new'),
      },
    };
  });
  expect(read.before.letter).toBe('F');
  expect(read.before.context).toStrictEqual({ resolved: false, authors: [] });
  expect(read.before.join).toContain('the name "official registry" is the name of no known author');
  expect(read.after.letter).toBe('A');
  expect(read.after.context).toMatchObject({
    resolved: false,
    authors: [{ name: 'official registry', letter: 'A', reference: true }],
  });
});

test('the approval is written once, and a second approval changes nothing', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await storeUnapproved(ask, 'Official Registry', 'A');
    const first = await approve(ask);
    const second = await approve(ask);
    return { first, second };
  });
  expect(read.first).toStrictEqual([{ n: 1 }]);
  expect(read.second).toStrictEqual([{ n: 0 }]);
});

test('the worker role cannot approve a set, give A or B, or store a reference author', async () => {
  const faults = await rolledBack('superuser', async (ask) => ({
    approve: await refusal(ask, () =>
      as(ask, 'gabriel_agent', () => ask('SELECT public.approve_reference_set()')),
    ),
    reference: await refusal(ask, () =>
      as(ask, 'gabriel_agent', () =>
        ask(`SELECT public.store_reference_author('X', 'A', 'm', 'r', '{}', NULL, false)`),
      ),
    ),
    letter: await refusal(ask, () =>
      as(ask, 'gabriel_agent', () =>
        ask(`SELECT public.store_author_letter('X', 'B', 'm', 'r', '{Y}', NULL, false)`),
      ),
    ),
  }));
  expect(faults.approve).toContain('permission denied');
  expect(faults.reference).toContain('permission denied');
  expect(faults.letter).toContain('A and B come from the reference set');
});

test('a new originator queues one rating job, with no click of the operator', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await cited(ask, { author: '  Trade   Journal ', label: label() });
    await cited(ask, { author: 'trade journal', label: label() });
    return jobsOf(ask, 'trade journal');
  });
  expect(read).toStrictEqual(['queued']);
});

test('a known author, even through a joined name, queues no job', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await reference(ask, 'Official Registry', 'A');
    await join(ask, 'The Registry', 'Official Registry');
    await cited(ask, { author: 'Official Registry', label: label() });
    await cited(ask, { author: 'The Registry', label: label() });
    return [await jobsOf(ask, 'official registry'), await jobsOf(ask, 'the registry')];
  });
  expect(read).toStrictEqual([[], []]);
});

test('the claim waits for the approval of the set, and then gives the name', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await cited(ask, { author: 'Trade Journal', label: label() });
    // Other jobs may wait in the queue, so each claim takes the next one until the queue is empty.
    const claimAll = async (): Promise<readonly string[]> => {
      const kinds: string[] = [];
      for (;;) {
        const [row] = z
          .array(z.object({ job_kind: z.string(), job_author: z.string().nullable() }))
          .parse(
            await as(ask, 'gabriel_agent', () =>
              ask('SELECT job_kind, job_author FROM public.claim_job()'),
            ),
          );
        if (row === undefined) return kinds;
        kinds.push(row.job_kind === 'rate_author' ? `rate ${String(row.job_author)}` : 'other');
      }
    };
    const early = await claimAll();
    await storeUnapproved(ask, 'Official Registry', 'A');
    await approve(ask);
    return { early, late: await claimAll() };
  });
  expect(read.early).not.toContain('rate trade journal');
  expect(read.late).toContain('rate trade journal');
});
