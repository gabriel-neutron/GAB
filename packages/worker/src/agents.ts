import type { Failure, Question } from '@gab/model';

import type { ClaimedJob } from './claim.ts';
import type { Queryable } from './queryable.ts';
import type { ModelConfig } from './reader-config.ts';

/** A question that the model answered with a value or with one tool call. */
export type Asked<T> = (
  | { readonly kind: 'value'; readonly value: T }
  | {
      readonly kind: 'call';
      readonly call: { readonly id: string; readonly name: string; readonly input: unknown };
    }
) & {
  /** The record of this call. A proposal that this answer led to names it. */
  readonly callId: string;
  readonly served: string;
  readonly tokens: number;
};

/** The model stopped a question, and the runner fails the job with its reason. */
export class ModelFailure extends Error {
  readonly failure: Failure;

  constructor(failure: Failure) {
    super(failure.reason);
    this.failure = failure;
  }
}

/** The agent ends its job for a reason that no retry inside the job mends. The runner fails the
 * job with this reason at once, as it does for any other failure. */
export class JobStop extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = 'JobStop';
    this.reason = reason;
  }
}

/** A tool call that the agent refused, and the sentence it gave. */
export interface Refusal {
  readonly tool: string;
  readonly reason: string;
}

/** The parts of a job that reads a document in parts: how many it read, how many the propose
 * door refused, and the first refusal. */
export interface PartCount {
  readonly parts: number;
  readonly refused: number;
  readonly firstRefusal: string | null;
}

/** What an agent returns when its job ran to its end. */
export interface AgentResult {
  readonly refusals: readonly Refusal[];
  /** Only an agent that reads in parts gives a count. */
  readonly parts?: PartCount;
  /** The count of the items that code dropped before the write, for each reason. */
  readonly dropped?: Readonly<Record<string, number>>;
  /** The reason of a stop that is a good end, such as the budget of a deepening search. The job
   * is done, and its row keeps this reason. */
  readonly stop?: string;
}

/** What the runner gives to the agent of one job. */
export interface AgentContext {
  readonly job: ClaimedJob;
  /** The connection of the worker. An agent writes proposals through its tools
   * on this connection and writes nothing else. */
  readonly db: Queryable;
  /** One question to one model of the agent. The call is recorded before this returns, so a
   * proposal that follows can name it. A failed question is recorded too, and it throws a
   * ModelFailure. All the models of the agent spend one token budget for each job. */
  readonly ask: <T>(model: ModelConfig, question: Omit<Question<T>, 'budget'>) => Promise<Asked<T>>;
}

/** One back-end agent. The runner hands it a job of its kind and ends the job itself. */
export interface RunnerAgent {
  readonly name: string;
  readonly version: string;
  readonly kind: ClaimedJob['kind'];
  /** The models that the agent asks. Each one is pinned. */
  readonly models: readonly ModelConfig[];
  /** The soft stop of the tokens of one job. */
  readonly tokenCap: number;
  readonly run: (context: AgentContext) => Promise<AgentResult>;
}
