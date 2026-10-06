import {
  openBudget,
  openModel,
  REASON,
  worstQuestionMs,
  type AgentModel,
  type Message,
  type Model,
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
import { idempotencyKey, promptDigest } from './idempotency.ts';
import { personalCategories } from './minimise.ts';
import type { Queryable } from './queryable.ts';

const SETTINGS = `SELECT lease_seconds, quota_wait_seconds, empty_wait_seconds
  FROM public.runner_settings()`;
const RECORD = `SELECT public.record_model_call($1::text, $2::text, $3::text, $4::text, $5::text,
  $6::int, $7::text, $8::uuid, $9::text, $10::int, $11::int, $12::text, $13::text[])::text AS id`;
const RELEASE = 'SELECT public.release_job_for_quota($1::uuid)';
const FAIL = 'SELECT public.fail_job($1::uuid, $2::text)';
const COMPLETE = 'SELECT public.complete_job($1::uuid)';

const MS = 1000;

// A spent quota fails no job, so it returns the job to the queue for every agent. An agent that
// must never fall back names more failures of its own.
const RELEASE_ON: NonNullable<RunnerAgent['releaseOn']> = { [REASON.quota]: 'quota' };

// Origin: decided by the operator on 26 September 2026. A job gets three claims. A failure on the
// first or the second leaves the row running, and the end of its lease returns it to the queue.
// The failure of the third ends the job as failed.
const MAX_ATTEMPTS = 3;

const settingsRow = z.object({
  lease_seconds: z.number().positive(),
  quota_wait_seconds: z.number().positive(),
  empty_wait_seconds: z.number().positive(),
});

const recorded = z.object({ id: z.uuid() });

/** The three rows of the parameter table that the runner reads, in seconds. */
export type RunnerSettings = z.infer<typeof settingsRow>;

/** The seconds that one job may take at the worst, waits included. An agent with no model asks
 * nothing, so its questions take no time. */
export const worstJobSeconds = (agent: RunnerAgent): number =>
  agent.settings === undefined
    ? 0
    : Math.ceil((agent.questionsPerJob * worstQuestionMs(agent.settings)) / MS);

/** Throws when the lease is shorter than the worst job of an agent. A claim whose lease ends
 * returns to the queue under a worker that still works, and the job then runs twice. */
export const checkLease = (leaseSeconds: number, agents: readonly RunnerAgent[]): void => {
  const short = agents.filter((agent) => worstJobSeconds(agent) > leaseSeconds);
  if (short.length === 0) return;
  const named = short
    .map((agent) => `${agent.name} needs ${String(worstJobSeconds(agent))} seconds`)
    .join('; ');
  throw new Error(
    `The claim lease is ${String(leaseSeconds)} seconds, and it is shorter than the worst job: ` +
      `${named}. Raise job_claim_lease_seconds, or lower the questions of the agent.`,
  );
};

/** The seams of the runner. A test gives a stub for each one. */
export interface RunnerDeps {
  /** The connection of gabriel_agent. */
  readonly db: Queryable;
  readonly agents: readonly RunnerAgent[];
  /** Waits for the given milliseconds. */
  readonly sleep: (ms: number) => Promise<void>;
  /** The clock in milliseconds, read to time each call of the model. */
  readonly now: () => number;
  /** Opens the line to a model. The default is the client of the package. */
  readonly open?: (settings: AgentModel) => Model;
}

/** What one step of the runner did. */
export type Step =
  | { readonly did: 'paused' }
  | { readonly did: 'idle' }
  | { readonly did: 'done'; readonly job: string }
  | { readonly did: 'released'; readonly job: string; readonly reason: string }
  | { readonly did: 'failed'; readonly job: string }
  | { readonly did: 'left'; readonly job: string };

export interface Runner {
  readonly settings: RunnerSettings;
  /** Takes at most one job, and waits when there is nothing to take. */
  readonly step: () => Promise<Step>;
  /** Steps until the signal aborts. */
  readonly run: (signal: AbortSignal) => Promise<void>;
}

// The cause of an error that is not a failure of the model goes to the log. The record of the job
// holds this sentence, because the cause can quote a path, an address or a document.
const UNKNOWN_FAULT = 'the agent stopped with an error, and nothing more is known';

/** Reads the settings and checks the lease. It throws, and starts nothing, when an agent is
 * absent, a row is absent or the lease is short. */
export const openRunner = async (deps: RunnerDeps): Promise<Runner> => {
  if (deps.agents.length === 0)
    throw new Error('The runner has no agent to run, so it claims nothing.');

  const settings = settingsRow.parse((await deps.db.query(SETTINGS)).rows[0]);
  checkLease(settings.lease_seconds, deps.agents);

  const open = deps.open ?? ((given: AgentModel): Model => openModel(given));
  const lines = new Map(
    deps.agents.flatMap((agent) =>
      agent.settings === undefined ? [] : [[agent, open(agent.settings)] as const],
    ),
  );
  const byKind = new Map(deps.agents.map((agent) => [agent.kind, agent] as const));

  // A pool with no figure is a pool the gateway never observed, and it counts as open. A read
  // that fails, or a gateway with no pool at all, is no proof of quota, so the runner waits: a
  // job that is not claimed spends no attempt.
  const quotaIsOpen = async (): Promise<boolean> => {
    for (const line of new Set(lines.values())) {
      if (line.quota === undefined) continue;
      const read = await line.quota();
      if (!read.ok) return false;
      if (!read.pools.some((pool) => pool.remaining === null || pool.remaining > 0)) return false;
    }
    return true;
  };

  const record = async (
    agent: RunnerAgent & { readonly settings: AgentModel; readonly minimiser: string },
    job: ClaimedJob,
    row: {
      promptHash: string;
      latencyMs: number;
      outcome: string;
      served: string | undefined;
      categories: readonly string[];
    },
  ): Promise<string> => {
    const made = recorded.parse(
      (
        await deps.db.query(RECORD, [
          agent.name,
          agent.version,
          agent.settings.endpoint,
          agent.settings.model,
          row.promptHash,
          row.latencyMs,
          row.outcome,
          job.id,
          row.served ?? null,
          null,
          null,
          agent.minimiser,
          [...row.categories],
        ])
      ).rows[0],
    );
    return made.id;
  };

  // The categories of personal data that a question still holds after the minimiser of the agent
  // ran. The record of the call stores them, so a category that a task allowed stays visible.
  const categoriesOf = (messages: readonly Message[]): string[] =>
    personalCategories(
      messages
        .map((message) =>
          [
            message.content,
            ...('tool_calls' in message
              ? (message.tool_calls ?? []).map((call) => call.function.arguments)
              : []),
          ].join('\n'),
        )
        .join('\n'),
    );

  const contextOf = (agent: RunnerAgent, job: ClaimedJob): AgentContext => {
    const line = lines.get(agent);
    const budget = openBudget(agent.tokenCap);

    const ask = async <T>(question: Omit<Question<T>, 'budget'>): Promise<Asked<T>> => {
      const settings = agent.settings;
      if (line === undefined || settings === undefined)
        throw new Error(`The agent ${agent.name} has no line to a model.`);
      // A call with no minimiser record is refused before the model reads one word of it.
      const minimiser = agent.minimiser;
      if (minimiser === undefined) throw new JobStop('no_minimiser');
      const promptHash = promptDigest(question.messages);
      const categories = categoriesOf(question.messages);
      const started = deps.now();
      const answer = await line.ask<T>({ ...question, budget });
      const latencyMs = Math.max(0, Math.round(deps.now() - started));
      const outcome = answer.ok ? 'ok' : answer.failure.kind;
      // The call lands before any proposal that it leads to, and it lands when it failed too.
      const callId = await record({ ...agent, settings, minimiser }, job, {
        promptHash,
        latencyMs,
        outcome,
        served: answer.served,
        categories,
      });
      if (!answer.ok) throw new ModelFailure(answer.failure);
      if (answer.served === undefined)
        throw new Error('the client gave an answer with no served model');
      const common = { callId, promptHash, served: answer.served, tokens: answer.tokens };
      if ('call' in answer) return { kind: 'call', call: answer.call, ...common };
      return { kind: 'value', value: answer.value, ...common };
    };

    return {
      job,
      db: deps.db,
      ask,
      keyOf: (parts) =>
        idempotencyKey({
          ...parts,
          documentId: job.documentId,
          readerId: `${agent.name}@${agent.version}`,
        }),
    };
  };

  const fail = async (job: ClaimedJob, reason: string): Promise<void> => {
    await deps.db.query(FAIL, [job.id, reason]);
  };

  // A failure follows the limit of three claims. Before the third the row stays running, because
  // only the end of its lease returns it, and the failure counts of the row stay as they were.
  const failed = async (job: ClaimedJob, reason: string): Promise<Step> => {
    if (job.attempt < MAX_ATTEMPTS) return { did: 'left', job: job.id };
    await fail(job, reason);
    return { did: 'failed', job: job.id };
  };

  const work = async (agent: RunnerAgent, job: ClaimedJob): Promise<Step> => {
    try {
      const result = await agent.run(contextOf(agent, job));
      // No table holds a refusal yet, so the log is its record. A refusal ends no job.
      if (result.refusals.length > 0)
        console.error('the agent refused tool calls', {
          agent: agent.name,
          job: job.id,
          refusals: result.refusals,
        });
    } catch (cause) {
      if (cause instanceof JobStop) return failed(job, cause.reason);
      if (cause instanceof ModelFailure) {
        const reason = (agent.releaseOn ?? RELEASE_ON)[cause.failure.kind];
        if (reason !== undefined) {
          // The door of the release takes no reason, so the log is the record of it, and the
          // record of the call keeps the kind of the failure.
          await deps.db.query(RELEASE, [job.id]);
          console.error('the runner returned a job to the queue', {
            agent: agent.name,
            job: job.id,
            reason,
          });
          return { did: 'released', job: job.id, reason };
        }
        return failed(job, cause.failure.reason);
      }
      console.error('the agent stopped with an error', { agent: agent.name, cause });
      return failed(job, UNKNOWN_FAULT);
    }
    await deps.db.query(COMPLETE, [job.id]);
    return { did: 'done', job: job.id };
  };

  const waitOf = (step: Step): number => {
    if (step.did === 'paused' || step.did === 'released') return settings.quota_wait_seconds * MS;
    if (step.did === 'idle') return settings.empty_wait_seconds * MS;
    return 0;
  };

  const once = async (): Promise<Step> => {
    if (!(await quotaIsOpen())) return { did: 'paused' };

    const job = await claimJob(deps.db);
    if (job === null) return { did: 'idle' };

    const agent = byKind.get(job.kind);
    if (agent === undefined) {
      await fail(job, `no agent is registered for the kind ${job.kind}`);
      return { did: 'failed', job: job.id };
    }
    return work(agent, job);
  };

  const step = async (): Promise<Step> => {
    const done = await once();
    const ms = waitOf(done);
    if (ms > 0) await deps.sleep(ms);
    return done;
  };

  return {
    settings,
    step,
    run: async (signal) => {
      while (!signal.aborted) await step();
    },
  };
};
