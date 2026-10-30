import {
  openrouterModel,
  PROVIDER,
  openBudget,
  openModel,
  type CallRecord,
  type Question,
} from '@gab/model';
import { z } from 'zod';

import {
  JobStop,
  ModelFailure,
  type Asked,
  type AgentContext,
  type RunnerAgent,
} from './agents.ts';
import { claimJob, type ClaimedJob } from './claim.ts';
import { layoutRefresher } from './layout-refresh.ts';
import type { Queryable } from './queryable.ts';
import type { ModelConfig } from './reader-config.ts';

const SETTINGS = 'SELECT empty_wait_seconds FROM public.runner_settings()';
const TRY_LOCK = 'SELECT pg_try_advisory_lock($1::bigint) AS locked';
const REQUEUE = 'SELECT public.requeue_running_jobs()';
const RECORD = `SELECT public.record_model_call($1::text, $2::text, $3::text, $4::text, $5::text,
  $6::int, $7::text, $8::uuid, $9::text, $10::int, $11::int)::text AS id`;
const FAIL = 'SELECT public.fail_job($1::uuid, $2::text)';
const COMPLETE = `SELECT public.complete_job($1::uuid, $2::int, $3::int, $4::text, $5::text) AS status`;

const MS = 1000;

// The key of the advisory lock that lets one runner live. REQUEUE puts back each running row of the
// role, so a second runner would take the live job of the first. The number is fixed: it is
// 0x47414252554E, which spells "GABRUN" in ASCII. It is written in decimal because the text input
// of a bigint reads hexadecimal only from PostgreSQL 16. No other code of the database uses it.
const RUNNER_LOCK_KEY = '78345611138382';

// External constraint: a pool reports a lost connection with a code of Node, a state of the server
// (class 08, or a shutdown), or the sentence of pg. The sleep of the computer, a restart of the
// database and a drop of the network all give one of them. The job is not at fault then. A protocol
// violation (08P01) is a bug of the code, and no wait cures it.
const NODE_FAULTS = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);
const SHUTDOWN_STATES = new Set(['57P01', '57P02', '57P03']);

const isConnectionFault = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const code = 'code' in error ? error.code : undefined;
  if (
    typeof code === 'string' &&
    (NODE_FAULTS.has(code) ||
      SHUTDOWN_STATES.has(code) ||
      (code.startsWith('08') && code !== '08P01'))
  )
    return true;
  // External constraint: pg gives a client whose connection died this error with no code.
  return (
    error.message.startsWith('Connection terminated') || error.message.endsWith('is not queryable')
  );
};

const lockRow = z.object({ locked: z.boolean() });

const settingsRow = z.object({ empty_wait_seconds: z.number().positive() });

const recorded = z.object({ id: z.uuid() });

const ended = z.object({ status: z.enum(['done', 'failed']) });

/** Records one call of the model through the door of the agent role, and gives its identifier. A
 * call outside a job names no job. */
export const recordModelCall = async (
  db: Queryable,
  agent: { readonly name: string; readonly version: string },
  jobId: string | null,
  call: CallRecord,
): Promise<string> =>
  recorded.parse(
    (
      await db.query(RECORD, [
        agent.name,
        agent.version,
        PROVIDER,
        call.requested,
        call.promptSha256,
        call.latencyMs,
        call.outcome,
        jobId,
        call.served ?? null,
        call.inputTokens,
        call.outputTokens,
      ])
    ).rows[0],
  ).id;

/** The seams of the runner. */
export interface RunnerDeps {
  /** The connection of gabriel_agent. */
  readonly db: Queryable;
  readonly agents: readonly RunnerAgent[];
  /** Waits for the given milliseconds. */
  readonly sleep: (ms: number) => Promise<void>;
  /** The clock in milliseconds, read to time each call of the model. */
  readonly now: () => number;
  /** Opens the dedicated connection that holds the lock of the one runner. A session lock lives as
   * long as its connection, so a pool query cannot hold it. The runner calls it again after a lost
   * connection. Release ends the connection. When it is absent, the runner takes no lock. */
  readonly lock?: () => Promise<RunnerLock>;
  /** Makes the pinned model of OpenRouter. The default reads the key from the environment. */
  readonly open?: (model: string) => ReturnType<typeof openrouterModel>;
  /** The most jobs that `run` works on at the same time, under the one lock. A job keeps its own
   * token budget. When it is absent, `run` works on one job at a time. */
  readonly concurrency?: number;
}

/** A dedicated connection that holds the lock of the one runner. */
export interface RunnerLock extends Queryable {
  readonly release: () => Promise<void>;
}

/** What one step of the runner did. */
export type Step =
  | { readonly did: 'idle' }
  | { readonly did: 'done'; readonly job: string }
  | { readonly did: 'failed'; readonly job: string };

interface Runner {
  /** Takes at most one job, and waits when there is nothing to take. */
  readonly step: () => Promise<Step>;
  /** Steps until the signal aborts. */
  readonly run: (signal: AbortSignal) => Promise<void>;
  /** Gives back the lock. Call it once, when the runner stops. */
  readonly close: () => Promise<void>;
}

// The cause of an error that is not a failure of the model goes to the log. The record of the job
// holds this sentence, because the cause can quote a path, an address or a document.
const UNKNOWN_FAULT = 'the agent stopped with an error, and nothing more is known';

/** Reads the settings and puts back each job that a crash left running. It throws, and starts
 * nothing, when an agent or a setting is absent. */
export const openRunner = async (deps: RunnerDeps): Promise<Runner> => {
  if (deps.agents.length === 0)
    throw new Error('The runner has no agent to run, so it claims nothing.');
  if (
    deps.concurrency !== undefined &&
    !(Number.isInteger(deps.concurrency) && deps.concurrency > 0)
  )
    throw new Error('The concurrency of the runner must be a whole number above zero.');

  // The runner marks each error that a query of the database throws. A code of Node alone does not
  // show the origin: the store of the files refuses a connection with the same code. Only a marked
  // error shows that the database is gone.
  const fromDatabase = new WeakSet<Error>();
  const db: Queryable = {
    query: async (text, values) => {
      try {
        return await deps.db.query(text, values);
      } catch (cause) {
        if (cause instanceof Error) fromDatabase.add(cause);
        throw cause;
      }
    },
  };

  // The lock comes first: a runner that does not hold it claims nothing and puts nothing back.
  let seat: RunnerLock | undefined;
  const letGo = async (): Promise<void> => {
    const old = seat;
    seat = undefined;
    await old?.release().catch(() => undefined);
  };
  const takeLock = async (): Promise<void> => {
    await letGo();
    if (deps.lock === undefined) return;
    const fresh = await deps.lock();
    try {
      const { locked } = lockRow.parse((await fresh.query(TRY_LOCK, [RUNNER_LOCK_KEY])).rows[0]);
      if (!locked)
        throw new Error('Another runner is running, so this runner stops and claims nothing.');
    } catch (cause) {
      await fresh.release().catch(() => undefined);
      throw cause;
    }
    seat = fresh;
  };

  // The connection of the lock can end with no sign (an idle limit, a restart of the server). The
  // same session asks for the lock again before each step: it answers yes while the session holds
  // it, and it takes the lock again in a new session. A no means that another runner holds it.
  const keepLock = async (): Promise<void> => {
    if (seat === undefined) return;
    const { locked } = lockRow.parse((await seat.query(TRY_LOCK, [RUNNER_LOCK_KEY])).rows[0]);
    if (!locked) throw new Error('Another runner took the lock, so this runner stops.');
  };

  await takeLock();
  let settings;
  try {
    settings = settingsRow.parse((await db.query(SETTINGS)).rows[0]);
    await db.query(REQUEUE);
  } catch (cause) {
    await letGo();
    throw cause;
  }

  // Each model is made at the start, so a key that is not set stops the start and claims
  // nothing.
  const open = deps.open ?? ((model: string) => openrouterModel(model));
  const made = new Map(
    deps.agents.flatMap((agent) => agent.models).map((one) => [one, open(one.model)] as const),
  );
  const byKind = new Map(deps.agents.map((agent) => [agent.kind, agent] as const));

  const record = (agent: RunnerAgent, job: ClaimedJob, call: CallRecord): Promise<string> =>
    recordModelCall(db, agent, job.id, call);

  const contextOf = (agent: RunnerAgent, job: ClaimedJob): AgentContext => {
    // A deepening search carries the budget that the operator set, and it replaces the cap.
    const budget = openBudget(
      job.kind === 'research_lead' ? (job.tokenBudget ?? agent.tokenCap) : agent.tokenCap,
    );

    const ask = async <T>(
      model: ModelConfig,
      question: Omit<Question<T>, 'budget'>,
    ): Promise<Asked<T>> => {
      const language = made.get(model);
      if (language === undefined || !agent.models.includes(model))
        throw new Error(`The agent ${agent.name} asks a model that it did not declare.`);
      const line = openModel(language, model.line, {
        record: (call) => record(agent, job, call),
        sleep: deps.sleep,
        now: deps.now,
      });
      const answer = await line.ask<T>({ ...question, budget });
      if (!answer.ok) throw new ModelFailure(answer.failure);
      if (answer.served === undefined)
        throw new Error('the adapter gave an answer with no served model');
      const common = { callId: answer.callId, served: answer.served, tokens: answer.tokens };
      if ('call' in answer) return { kind: 'call', call: answer.call, ...common };
      return { kind: 'value', value: answer.value, ...common };
    };

    return { job, db, ask };
  };

  const fail = async (job: ClaimedJob, reason: string): Promise<Step> => {
    await db.query(FAIL, [job.id, reason]);
    return { did: 'failed', job: job.id };
  };

  const work = async (agent: RunnerAgent, job: ClaimedJob): Promise<Step> => {
    let result;
    try {
      result = await agent.run(contextOf(agent, job));
    } catch (cause) {
      // The job is not at fault, and the connection that would fail it is gone. The runner waits and
      // puts the job back in the queue.
      if (isConnectionFault(cause) && cause instanceof Error && fromDatabase.has(cause))
        throw cause;
      if (cause instanceof JobStop) return fail(job, cause.reason);
      if (cause instanceof ModelFailure) return fail(job, cause.failure.reason);
      console.error('the agent stopped with an error', { agent: agent.name, cause });
      return fail(job, UNKNOWN_FAULT);
    }
    // The job keeps the count of the refused parts. The log keeps each refused call.
    if (result.refusals.length > 0)
      console.error('the agent refused tool calls', {
        agent: agent.name,
        job: job.id,
        refusals: result.refusals,
      });
    if (result.dropped !== undefined && Object.keys(result.dropped).length > 0)
      console.info('the agent dropped items', {
        agent: agent.name,
        job: job.id,
        dropped: result.dropped,
      });
    const parts = result.parts ?? { parts: 0, refused: 0, firstRefusal: null };
    let answer;
    try {
      answer = await db.query(COMPLETE, [
        job.id,
        parts.parts,
        parts.refused,
        parts.firstRefusal,
        result.stop ?? null,
      ]);
    } catch (cause) {
      // A lost connection puts the job back. Any other refusal of the end fails the job: a job left
      // running would go back at the next start, and run and pay for its model calls again.
      if (isConnectionFault(cause)) throw cause;
      console.error('the record refused the end of the job', { agent: agent.name, cause });
      const reason = cause instanceof Error ? cause.message : UNKNOWN_FAULT;
      return fail(job, `the record refused the end of the job: ${reason}`);
    }
    const { status } = ended.parse(answer.rows[0]);
    return { did: status, job: job.id };
  };

  // The worker holds the role that may store a layout, so an idle step keeps the layout fresh.
  const refreshLayout = layoutRefresher({ db, now: deps.now });

  const once = async (): Promise<Step> => {
    const job = await claimJob(db);
    if (job === null) {
      await refreshLayout();
      return { did: 'idle' };
    }

    const agent = byKind.get(job.kind);
    if (agent === undefined) return fail(job, `no agent is registered for the kind ${job.kind}`);
    return work(agent, job);
  };

  const step = async (): Promise<Step> => {
    const done = await once();
    if (done.did === 'idle') await deps.sleep(settings.empty_wait_seconds * MS);
    return done;
  };

  // One slot takes one job at a time. The caller checked the lock before the first step.
  const slot = async (signal: AbortSignal): Promise<void> => {
    for (let first = true; !signal.aborted; first = false) {
      if (!first) await keepLock();
      await step();
    }
  };

  // The slots run together. An error in one slot stops the others after the job in hand, and the
  // first error goes up, so the recovery below never puts back a job that a slot still runs.
  const slots = async (signal: AbortSignal): Promise<void> => {
    const halt = new AbortController();
    const stopped = AbortSignal.any([signal, halt.signal]);
    const ends = await Promise.allSettled(
      Array.from({ length: deps.concurrency ?? 1 }, () =>
        slot(stopped).catch((error: unknown) => {
          halt.abort();
          throw error;
        }),
      ),
    );
    const bad = ends.find((end) => end.status === 'rejected');
    if (bad !== undefined) throw bad.reason;
  };

  return {
    step,
    run: async (signal) => {
      let lost = false;
      while (!signal.aborted) {
        try {
          // Each running row of the role is ours, and no slot runs at this point: the job in hand
          // goes back. A lost connection drops the lock, so the runner takes it again first.
          if (lost) {
            await takeLock();
            await db.query(REQUEUE);
            lost = false;
          } else await keepLock();
          await slots(signal);
        } catch (error) {
          if (!isConnectionFault(error)) throw error;
          lost = true;
          console.error('the database connection failed, and the runner waits', String(error));
          await deps.sleep(settings.empty_wait_seconds * MS);
        }
      }
    },
    close: letGo,
  };
};
