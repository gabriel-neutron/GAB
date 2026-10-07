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
import type { Queryable } from './queryable.ts';
import type { ModelConfig } from './reader-config.ts';

const SETTINGS = 'SELECT empty_wait_seconds FROM public.runner_settings()';
const REQUEUE = 'SELECT public.requeue_running_jobs()';
const RECORD = `SELECT public.record_model_call($1::text, $2::text, $3::text, $4::text, $5::text,
  $6::int, $7::text, $8::uuid, $9::text, $10::int, $11::int)::text AS id`;
const FAIL = 'SELECT public.fail_job($1::uuid, $2::text)';
const COMPLETE = `SELECT public.complete_job($1::uuid, $2::int, $3::int, $4::text) AS status`;

const MS = 1000;

const settingsRow = z.object({ empty_wait_seconds: z.number().positive() });

const recorded = z.object({ id: z.uuid() });

const ended = z.object({ status: z.enum(['done', 'failed']) });

/** The seams of the runner. */
export interface RunnerDeps {
  /** The connection of gabriel_agent. */
  readonly db: Queryable;
  readonly agents: readonly RunnerAgent[];
  /** Waits for the given milliseconds. */
  readonly sleep: (ms: number) => Promise<void>;
  /** The clock in milliseconds, read to time each call of the model. */
  readonly now: () => number;
  /** Makes the pinned model of OpenRouter. The default reads the key from the environment. */
  readonly open?: (model: string) => ReturnType<typeof openrouterModel>;
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
}

// The cause of an error that is not a failure of the model goes to the log. The record of the job
// holds this sentence, because the cause can quote a path, an address or a document.
const UNKNOWN_FAULT = 'the agent stopped with an error, and nothing more is known';

/** Reads the settings and puts back each job that a crash left running. It throws, and starts
 * nothing, when an agent or a setting is absent. */
export const openRunner = async (deps: RunnerDeps): Promise<Runner> => {
  if (deps.agents.length === 0)
    throw new Error('The runner has no agent to run, so it claims nothing.');

  const settings = settingsRow.parse((await deps.db.query(SETTINGS)).rows[0]);
  await deps.db.query(REQUEUE);

  // Each model is made at the start, so a key that is not set stops the start and claims
  // nothing.
  const open = deps.open ?? ((model: string) => openrouterModel(model));
  const made = new Map(
    deps.agents.flatMap((agent) => agent.models).map((one) => [one, open(one.model)] as const),
  );
  const byKind = new Map(deps.agents.map((agent) => [agent.kind, agent] as const));

  const record = async (agent: RunnerAgent, job: ClaimedJob, call: CallRecord): Promise<string> =>
    recorded.parse(
      (
        await deps.db.query(RECORD, [
          agent.name,
          agent.version,
          PROVIDER,
          call.requested,
          call.promptSha256,
          call.latencyMs,
          call.outcome,
          job.id,
          call.served ?? null,
          call.inputTokens,
          call.outputTokens,
        ])
      ).rows[0],
    ).id;

  const contextOf = (agent: RunnerAgent, job: ClaimedJob): AgentContext => {
    const budget = openBudget(agent.tokenCap);

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

    return { job, db: deps.db, ask };
  };

  const fail = async (job: ClaimedJob, reason: string): Promise<Step> => {
    await deps.db.query(FAIL, [job.id, reason]);
    return { did: 'failed', job: job.id };
  };

  const work = async (agent: RunnerAgent, job: ClaimedJob): Promise<Step> => {
    let result;
    try {
      result = await agent.run(contextOf(agent, job));
    } catch (cause) {
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
    const parts = result.parts ?? { parts: 0, refused: 0, firstRefusal: null };
    const { status } = ended.parse(
      (await deps.db.query(COMPLETE, [job.id, parts.parts, parts.refused, parts.firstRefusal]))
        .rows[0],
    );
    return { did: status, job: job.id };
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
