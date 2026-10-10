import { Pool, type PoolClient } from 'pg';
import { afterAll, expect, test, vi } from 'vitest';
import { z } from 'zod';

import { roleAddress } from '../address.ts';
import type { RaterConfig } from '../reader-config.ts';
import type { Queryable } from '../queryable.ts';
import { completionOf, depsOf, READER, routerOf } from '../runner-fixture.ts';
import { openRunner } from '../runner.ts';
import { makeRater } from './rater.ts';

// Departure: each test runs in one transaction that rolls back, on one connection that signs as
// the owner to seed and to read, as gabriel_app to approve a reference set, and as gabriel_agent
// while the runner works. The model is a fake answer: no test reaches OpenRouter.
z.object({ GABRIEL_DATABASE: z.literal('gabriel_test') }).parse(process.env);
const pool = new Pool({
  connectionString: roleAddress('gabriel', 'POSTGRES_PASSWORD'),
  max: 2,
});

afterAll(async () => {
  await pool.end();
});

const CONFIG: RaterConfig = { model: READER, tokenCap: 10_000 };

const STORE_REFERENCE = `SELECT public.store_reference_author($1, $2, 'a-strong-model', 'a reason',
  '{}'::text[], NULL, false)`;

const DOORS = /store_author_letter|join_author_name/u;

/** The connection as the rater sees it. A fault is an error of the connection that the door of the
 * worker raises, with the SQLSTATE code of the error. A refused door aborts the transaction of the
 * test, so each door runs behind a savepoint. */
const doorsOf = (client: PoolClient, fault: string | undefined): Queryable => ({
  query: (text, values) =>
    !DOORS.test(text)
      ? client.query(text, values)
      : fault === undefined
        ? behindSavepoint(client, text, values)
        : Promise.reject(Object.assign(new Error('the connection failed'), { code: fault })),
});

const behindSavepoint = async (client: PoolClient, text: string, values?: unknown[]) => {
  await client.query('SAVEPOINT door');
  try {
    return await client.query(text, values);
  } catch (cause) {
    await client.query('ROLLBACK TO SAVEPOINT door');
    throw cause;
  }
};

type Ask = (text: string, values?: unknown[]) => Promise<unknown[]>;

interface Held {
  readonly ask: Ask;
  /** Queues the rating of a new name. */
  readonly actOf: (author: string) => Promise<void>;
  /** The runner takes the oldest job and the rater answers it with this fake answer. */
  readonly rate: (answer: unknown, fault?: string) => Promise<'done' | 'failed' | 'idle'>;
  /** The same, with one fake answer for each question in turn. It gives the bodies of the
   * questions. */
  readonly rateInTurn: (
    answers: readonly unknown[],
  ) => Promise<{ did: 'done' | 'failed' | 'idle'; bodies: string[] }>;
  /** The reference author that the operator stored and did not approve yet. */
  readonly storeUnapproved: (name: string) => Promise<void>;
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
      storeUnapproved: async (name) => {
        await asRole('gabriel_app', () => ask(STORE_REFERENCE, [name, 'B']));
      },
      rate: async (answer, fault) => {
        const router = routerOf(() => completionOf(JSON.stringify(answer)));
        const db = doorsOf(client, fault);
        const { deps } = depsOf(db, [makeRater(CONFIG)], router);
        return asRole('gabriel_agent', async () => (await (await openRunner(deps)).step()).did);
      },
      rateInTurn: async (answers) => {
        const bodies: string[] = [];
        const router = routerOf((call, body) => {
          bodies.push(body);
          return completionOf(JSON.stringify(answers[call - 1]));
        });
        const { deps } = depsOf(doorsOf(client, undefined), [makeRater(CONFIG)], router);
        const did = await asRole(
          'gabriel_agent',
          async () => (await (await openRunner(deps)).step()).did,
        );
        return { did, bodies };
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

    // The name reads as F until the operator confirms it.
    expect(await held.letter('reuters wire')).toBe('F');
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

test.each([
  ['an invalid value', '22023'],
  ['a violated unique key', '23505'],
])(
  'an error of the door with the SQLSTATE of %s is a refusal that keeps the name',
  async (_name, code) => {
    await inTransaction(async (held) => {
      await held.actOf('Trade Journal');
      expect(await held.rate(NEW, code)).toBe('failed');
      expect((await jobOf(held, 'trade journal'))[0]?.failure_reason).toContain(
        'the connection failed',
      );

      await held.actOf('Trade Journal');
      expect(await jobOf(held, 'trade journal')).toHaveLength(1);
    });
  },
);

test.each([
  ['a deadlock', '40P01'],
  ['a lost connection', '08006'],
  ['a shutdown of the server', '57P01'],
])('%s is a fault that frees the name for a new rating', async (_name, code) => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    await inTransaction(async (held) => {
      await held.actOf('Trade Journal');
      expect(await held.rate(NEW, code)).toBe('failed');

      await held.actOf('Trade Journal');
      expect(await jobOf(held, 'trade journal')).toHaveLength(2);
      expect(await held.rate(NEW)).toBe('done');
      expect(await held.letter('trade journal')).toBe('D');
    });
  } finally {
    log.mockRestore();
  }
});

test('the name of an unapproved reference author ends the rating clean, and the name stays F', async () => {
  await inTransaction(async (held) => {
    await held.storeUnapproved('Trade Journal');
    await held.actOf('Trade Journal');
    expect(await held.rate(NEW)).toBe('failed');

    expect((await jobOf(held, 'trade journal'))[0]?.failure_reason).toContain(
      'already has an author',
    );
    expect(await held.letter('trade journal')).toBe('F');
    expect(await held.ask(`SELECT count(*)::int AS n FROM public.author`)).toStrictEqual([
      { n: 3 },
    ]);
  });
});

test('a refused rating keeps its call of the model in the record', async () => {
  await inTransaction(async (held) => {
    await held.actOf('Trade Journal');
    expect(await held.rate({ ...NEW, letter: 'A' })).toBe('failed');

    expect(
      await held.ask(
        `SELECT m.agent, m.requested_model, m.outcome
           FROM public.model_call m JOIN public.jobs j ON j.id = m.job_id
          WHERE j.kind = 'rate_author' AND j.author = 'trade journal'`,
      ),
    ).toStrictEqual([{ agent: 'rater', requested_model: READER.model, outcome: 'ok' }]);
  });
});

const callsOfName = async (held: Held, name: string) =>
  held.ask(
    `SELECT count(*)::int AS n FROM public.model_call m JOIN public.jobs j ON j.id = m.job_id
      WHERE j.kind = 'rate_author' AND j.author = $1`,
    [name],
  );

const callsOf = async (held: Held) =>
  held.ask(
    `SELECT count(*)::int AS n FROM public.model_call m JOIN public.jobs j ON j.id = m.job_id
      WHERE j.kind = 'rate_author' AND j.author = 'trade journal'`,
  );

test('the question gives the names of the reference set apart from the known authors', async () => {
  await inTransaction(async (held) => {
    await held.actOf('Trade Journal');
    const { bodies } = await held.rateInTurn([NEW]);

    const sent = z
      .object({ messages: z.array(z.object({ content: z.string() })) })
      .parse(JSON.parse(bodies[0] ?? '{}'));
    const asked = z
      .object({ references: z.array(z.string()) })
      .parse(JSON.parse(sent.messages[1]?.content ?? '{}'));
    expect(asked.references.toSorted()).toStrictEqual(['reuters', 'state register']);
  });
});

test('a comparison outside the reference set is asked again once, with the exact list', async () => {
  await inTransaction(async (held) => {
    await held.actOf('Trade Journal');
    const { did, bodies } = await held.rateInTurn([{ ...NEW, references: ['botaş'] }, NEW]);

    expect(did).toBe('done');
    expect(await held.letter('trade journal')).toBe('D');
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toContain('the reference set has no such author');
    expect(bodies[1]).toContain('Compare only with the names in this list');
    expect(await callsOf(held)).toStrictEqual([{ n: 2 }]);
  });
});

test('a second comparison outside the reference set is refused, and the author stays F', async () => {
  await inTransaction(async (held) => {
    await held.actOf('Trade Journal');
    const outside = { ...NEW, references: ['rosneft oil company'] };
    const { did, bodies } = await held.rateInTurn([outside, outside, NEW]);

    expect(did).toBe('failed');
    expect(bodies).toHaveLength(2);
    expect((await jobOf(held, 'trade journal'))[0]?.failure_reason).toContain(
      '"rosneft oil company", and the reference set has no such author',
    );
    expect(await held.letter('trade journal')).toBe('F');
    expect(await callsOf(held)).toStrictEqual([{ n: 2 }]);
  });
});

test('another refusal is not asked again', async () => {
  await inTransaction(async (held) => {
    await held.actOf('Trade Journal');
    const { did, bodies } = await held.rateInTurn([{ ...NEW, letter: 'A' }, NEW]);

    expect(did).toBe('failed');
    expect(bodies).toHaveLength(1);
    expect(await callsOf(held)).toStrictEqual([{ n: 1 }]);
  });
});

test.each([['OFAC; Reuters'], ['Reuters, State Register'], ['UK'], ['The Secretary of State']])(
  'a join of "%s" is refused, and the rater rates the name as a new author',
  async (name) => {
    await inTransaction(async (held) => {
      await held.actOf(name);
      const key = name.toLowerCase();
      const { did, bodies } = await held.rateInTurn([
        { kind: 'same', as: 'Reuters' },
        { ...NEW, letter: 'F' },
      ]);

      expect(did).toBe('done');
      expect(bodies).toHaveLength(2);
      expect(bodies[1]).toContain('Rate the name as a new author');
      expect(await held.letter(key)).toBe('F');
      expect(await callsOfName(held, key)).toStrictEqual([{ n: 2 }]);
      expect(
        await held.ask(
          `SELECT a.name_key, n.doubt FROM public.author_name n
             JOIN public.author a ON a.id = n.author_id WHERE n.name_key = $1`,
          [key],
        ),
      ).toStrictEqual([{ name_key: key, doubt: false }]);
    });
  },
);

test('a second join after a refused join is refused, and the author stays F', async () => {
  await inTransaction(async (held) => {
    await held.actOf('UK');
    const join = { kind: 'same', as: 'Reuters' };
    const { did, bodies } = await held.rateInTurn([join, join]);

    expect(did).toBe('failed');
    expect(bodies).toHaveLength(2);
    expect((await jobOf(held, 'uk'))[0]?.failure_reason).toContain('is generic');
    expect(await held.letter('uk')).toBe('F');
    expect(await callsOfName(held, 'uk')).toStrictEqual([{ n: 2 }]);
  });
});

test('a second answer that code refuses fails the job, and the author stays F', async () => {
  await inTransaction(async (held) => {
    await held.actOf('U.K.');
    const { did } = await held.rateInTurn([
      { kind: 'same', as: 'Reuters' },
      { ...NEW, letter: 'A' },
    ]);

    expect(did).toBe('failed');
    expect((await jobOf(held, 'u.k.'))[0]?.failure_reason).toContain('A and B come from');
    expect(await held.letter('u.k.')).toBe('F');
  });
});

test('a join that the door refuses for another cause is not asked again', async () => {
  await inTransaction(async (held) => {
    await held.storeUnapproved('Trade Journal');
    await held.actOf('Trade Journal');
    const { did, bodies } = await held.rateInTurn([{ kind: 'same', as: 'Reuters' }, NEW]);

    expect(did).toBe('failed');
    expect(bodies).toHaveLength(1);
  });
});

test.each([
  ['reuters', null],
  ['ministry of defence of russia', null],
  ['rosneft, pjsc', null],
  ['co., ltd', null],
  ['ofac; reuters', 'holds two authors'],
  ['reuters, tass', 'holds two authors'],
  ['rosneft, pjsc, tass', 'holds two authors'],
  ['u.s.', 'is generic'],
  ['the ministry', 'is generic'],
])('the name "%s" joins an author unless it is refused: %s', async (name, said) => {
  await inTransaction(async (held) => {
    const [row] = z
      .array(z.object({ said: z.string().nullable() }))
      .parse(await held.ask('SELECT public.name_joins_no_author($1) AS said', [name]));
    if (said === null) expect(row?.said).toBeNull();
    else expect(row?.said).toContain(said);
  });
});

test('a name that the operator refused is rated again as a new author', async () => {
  await inTransaction(async (held) => {
    await held.actOf('Reuters Wire');
    expect(await held.rate({ kind: 'same', as: 'Reuters' })).toBe('done');
    await held.ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
    await held.ask(`SELECT public.decide_author_name('Reuters Wire', false)`);
    await held.ask('RESET SESSION AUTHORIZATION');

    const { did, bodies } = await held.rateInTurn([{ kind: 'same', as: 'Reuters' }, NEW]);

    expect(did).toBe('done');
    expect(bodies[1]).toContain('the operator refused the name');
    expect(await held.letter('reuters wire')).toBe('D');
  });
});
