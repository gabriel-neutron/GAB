import { createHash } from 'node:crypto';

import {
  openBudget,
  openModel,
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
import type { Queryable } from './queryable.ts';

const SETTINGS = 'SELECT empty_wait_seconds FROM public.runner_settings()';
const REQUEUE = 'SELECT public.requeue_running_jobs()';
const RECORD = `SELECT public.record_model_call($1::text, $2::text, $3::text, $4::text, $5::text,
  $6::int, $7::text, $8::uuid, $9::text, $10::int, $11::int)::text AS id`;
const FAIL = 'SELECT public.fail_job($1::uuid, $2::text)';
const COMPLETE = 'SELECT public.complete_job($1::uuid)';

const MS = 1000;

const settingsRow = z.object({ empty_wait_seconds: z.number().positive() });

const recorded = z.object({ id: z.uuid() });

/** The seams of the runner. */
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
  | { readonly did: 'idle' }
  | { readonly did: 'done'; readonly job: string }
  | { readonly did: 'failed'; readonly job: string };

export interface Runner {
  /** Takes at most one job, and waits when there is nothing to take. */
  readonly step: () => Promise<Step>;
  /** Steps until the signal aborts. */
  readonly run: (signal: AbortSignal) => Promise<void>;
}

// The cause of an error that is not a failure of the model goes to the log. The record of the job
// holds this sentence, because the cause can quote a path, an address or a document.
const UNKNOWN_FAULT = 'the agent stopped with an error, and nothing more is known';

// The record of a call holds the digest of what the model was asked and never the prompt, which
// can quote an untrusted document.
const promptDigest = (messages: readonly Message[]): string =>
  createHash('sha256').update(JSON.stringify(messages)).digest('hex');

/** Reads the settings and puts back each job that a crash left running. It throws, and starts
 * nothing, when an agent or a setting is absent. */
export const openRunner = async (deps: RunnerDeps): Promise<Runner> => {
  if (deps.agents.length === 0)
    throw new Error('The runner has no agent to run, so it claims nothing.');

  const settings = settingsRow.parse((await deps.db.query(SETTINGS)).rows[0]);
  await deps.db.query(REQUEUE);

  const open = deps.open ?? ((given: AgentModel): Model => openModel(given));
  const lines = new Map(deps.agents.map((agent) => [agent, open(agent.settings)] as const));
  const byKind = new Map(deps.agents.map((agent) => [agent.kind, agent] as const));

  const record = async (
    agent: RunnerAgent,
    job: ClaimedJob,
    row: { promptHash: string; latencyMs: number; outcome: string; served: string | undefined },
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
        ])
      ).rows[0],
    );
    return made.id;
  };

  const contextOf = (agent: RunnerAgent, job: ClaimedJob): AgentContext => {
    const line = lines.get(agent);
    if (line === undefined) throw new Error(`The agent ${agent.name} has no line to a model.`);
    const budget = openBudget(agent.tokenCap);

    const ask = async <T>(question: Omit<Question<T>, 'budget'>): Promise<Asked<T>> => {
      const promptHash = promptDigest(question.messages);
      const started = deps.now();
      const answer = await line.ask<T>({ ...question, budget });
      const latencyMs = Math.max(0, Math.round(deps.now() - started));
      const outcome = answer.ok ? 'ok' : answer.failure.kind;
      // The call lands before any proposal that it leads to, and it lands when it failed too.
      const callId = await record(agent, job, {
        promptHash,
        latencyMs,
        outcome,
        served: answer.served,
      });
      if (!answer.ok) throw new ModelFailure(answer.failure);
      if (answer.served === undefined)
        throw new Error('the client gave an answer with no served model');
      const common = { callId, promptHash, served: answer.served, tokens: answer.tokens };
      if ('call' in answer) return { kind: 'call', call: answer.call, ...common };
      return { kind: 'value', value: answer.value, ...common };
    };

    return { job, db: deps.db, ask };
  };

  const fail = async (job: ClaimedJob, reason: string): Promise<Step> => {
    await deps.db.query(FAIL, [job.id, reason]);
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
      if (cause instanceof JobStop) return fail(job, cause.reason);
      if (cause instanceof ModelFailure) return fail(job, cause.failure.reason);
      console.error('the agent stopped with an error', { agent: agent.name, cause });
      return fail(job, UNKNOWN_FAULT);
    }
    await deps.db.query(COMPLETE, [job.id]);
    return { did: 'done', job: job.id };
  };

  const once = async (): Promise<Step> => {
    const job = await claimJob(deps.db);
    if (job === null) return { did: 'idle' };

    const agent = byKind.get(job.kind);
    if (agent === undefined) return fail(job, `no agent is registered for the kind ${job.kind}`);
    return work(agent, job);
  };

  const step = async (): Promise<Step> => {
    const done = await once();
    if (done.did === 'idle') await deps.sleep(settings.empty_wait_seconds * MS);
    return done;
  };

  return {
    step,
    run: async (signal) => {
      while (!signal.aborted) await step();
    },
  };
};
