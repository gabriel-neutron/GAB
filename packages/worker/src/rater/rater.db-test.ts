import { Pool, type PoolClient } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import type { RaterConfig } from '../reader-config.ts';
import { completionOf, depsOf, READER, routerOf } from '../runner-fixture.ts';
import { openRunner } from '../runner.ts';
import { makeRater } from './rater.ts';

// Departure: each test runs in one transaction that rolls back, on one connection that signs as
// the owner to seed and to read, as gabriel_app to approve a reference set, and as gabriel_agent
// while the runner works. The model is a fake answer: no test reaches OpenRouter.
const secrets = z.object({
  POSTGRES_PASSWORD: z.string().min(1),
  GABRIEL_DATABASE: z.literal('gabriel_test'),
});
const env = secrets.parse(process.env);
const pool = new Pool({
  connectionString: `postgresql://gabriel:${encodeURIComponent(env.POSTGRES_PASSWORD)}@127.0.0.1:5432/${env.GABRIEL_DATABASE}`,
  max: 2,
});

afterAll(async () => {
  await pool.end();
});

const CONFIG: RaterConfig = { model: READER, tokenCap: 10_000 };

const STORE_REFERENCE = `SELECT public.store_reference_author($1, $2, 'a-strong-model', 'a reason',
  '{}'::text[], NULL, false)`;

type Ask = (text: string, values?: unknown[]) => Promise<unknown[]>;

interface Held {
  readonly ask: Ask;
  /** Queues the rating of a new name. */
  readonly actOf: (author: string) => Promise<void>;
  /** The runner takes the oldest job and the rater answers it with this fake answer. */
  readonly rate: (answer: unknown) => Promise<'done' | 'failed' | 'idle'>;
  readonly letter: (name: string) => Promise<string>;
}

const inTransaction = async (work: (held: Held) => Promise<void>): Promise<void> => {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const ask: Ask = async (text, values = []) => {
      const found: { rows: unknown[] } = await client.query(text, values);
      return found.rows;
    };
    const asRole = async <T>(role: string, inner: () => Promise<T>): Promise<T> => {
      await client.query(`SET LOCAL SESSION AUTHORIZATION ${role}`);
      try {
        return await inner();
      } finally {
        await client.query('RESET SESSION AUTHORIZATION');
      }
    };
    for (const [name, letter] of [
      ['Reuters', 'B'],
      ['State Register', 'A'],
    ] as const)
      await asRole('gabriel_app', () => ask(STORE_REFERENCE, [name, letter]));
    await asRole('gabriel_app', () => ask('SELECT public.approve_reference_set()'));

    await work({
      ask,
      actOf: async (author) => {
        // The trigger that queues this job is tested in tools/rate-author.db-test.ts.
        await ask(
          `INSERT INTO public.jobs (kind, author, created_at)
           VALUES ('rate_author', $1, '1970-01-01') ON CONFLICT DO NOTHING`,
          [author.toLowerCase()],
        );
      },
      rate: async (answer) => {
        const router = routerOf(() => completionOf(JSON.stringify(answer)));
        const { deps } = depsOf(client, [makeRater(CONFIG)], router);
        return asRole('gabriel_agent', async () => (await (await openRunner(deps)).step()).did);
      },
      letter: async (name) =>
        z
          .array(z.object({ letter: z.string() }))
          .parse(
            await asRole('gabriel_app', () =>
              ask('SELECT public.letter_of($1)::text AS letter', [name]),
            ),
          )[0]?.letter ?? '',
    });
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
};

const jobOf = async (held: Held, name: string) =>
  z
    .array(z.object({ status: z.string(), failure_reason: z.string().nullable() }))
    .parse(
      await held.ask(
        `SELECT status, failure_reason FROM public.jobs WHERE kind = 'rate_author' AND author = $1`,
        [name],
      ),
    );

const NEW = {
  kind: 'new',
  letter: 'D',
  reason: 'it repeats the agencies and does not check',
  references: ['Reuters'],
  controller: 'A Holding',
  party: false,
};

test('a valid rating stores the letter with its reason, its references and its controller', async () => {
  await inTransaction(async (held) => {
    await held.actOf('Trade Journal');
    expect(await held.rate(NEW)).toBe('done');

    expect(await held.letter('trade journal')).toBe('D');
    expect(
      await held.ask(
        `SELECT letter::text, reason, reference_authors, controller, model, reference_set
           FROM public.author WHERE name_key = 'trade journal'`,
      ),
    ).toStrictEqual([
      {
        letter: 'D',
        reason: NEW.reason,
        reference_authors: ['reuters'],
        controller: 'A Holding',
        model: READER.model,
        reference_set: false,
      },
    ]);
  });
});

test('the call of the model is recorded, and it belongs to the job', async () => {
  await inTransaction(async (held) => {
    await held.actOf('Trade Journal');
    await held.rate(NEW);

    expect(
      await held.ask(
        `SELECT m.agent, m.requested_model, m.outcome
           FROM public.model_call m JOIN public.jobs j ON j.id = m.job_id
          WHERE j.kind = 'rate_author' AND j.author = 'trade journal'`,
      ),
    ).toStrictEqual([{ agent: 'rater', requested_model: READER.model, outcome: 'ok' }]);
  });
});

test('a name of a known author joins that author, and a join into A or B is a doubt', async () => {
  await inTransaction(async (held) => {
    await held.actOf('Reuters Wire');
    expect(await held.rate({ kind: 'same', as: 'Reuters' })).toBe('done');

    expect(await held.letter('reuters wire')).toBe('B');
    expect(
      await held.ask(`SELECT doubt FROM public.author_name WHERE name_key = 'reuters wire'`),
    ).toStrictEqual([{ doubt: true }]);
    expect(await held.ask(`SELECT count(*)::int AS n FROM public.author`)).toStrictEqual([
      { n: 2 },
    ]);
  });
});

test.each([
  ['a letter A', { ...NEW, letter: 'A' }, 'A and B come from the reference set'],
  ['a letter B', { ...NEW, letter: 'B' }, 'A and B come from the reference set'],
  ['no reference author', { ...NEW, references: [] }, 'no reference author'],
  [
    'an author outside the reference set',
    { ...NEW, references: ['Nobody'] },
    'the reference set has no such author',
  ],
  [
    'a party with no controller',
    { ...NEW, party: true, controller: null },
    'a party to the conflict with no controller',
  ],
  ['a join to a stranger', { kind: 'same', as: 'Nobody' }, 'no known author has that name'],
])(
  '%s is refused, the job keeps the reason, and the author stays F',
  async (_name, answer, said) => {
    await inTransaction(async (held) => {
      await held.actOf('Trade Journal');
      expect(await held.rate(answer)).toBe('failed');

      const [job] = await jobOf(held, 'trade journal');
      expect(job?.failure_reason).toContain(said);
      expect(await held.letter('trade journal')).toBe('F');
      expect(await held.ask(`SELECT count(*)::int AS n FROM public.author_name`)).toStrictEqual([
        { n: 2 },
      ]);

      // The refusal is not asked again at the next act of the name.
      await held.actOf('Trade Journal');
      expect(await jobOf(held, 'trade journal')).toHaveLength(1);
    });
  },
);
