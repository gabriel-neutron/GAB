import type { AgentModel, Failure, Question } from '@gab/model';

import type { ClaimedJob } from './claim.ts';
import type { KeyParts } from './idempotency.ts';
import type { Queryable } from './queryable.ts';

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
  readonly promptHash: string;
  readonly served: string;
  readonly tokens: number;
};

/** The model stopped a question, and the runner decides what the job does next. */
export class ModelFailure extends Error {
  readonly failure: Failure;

  constructor(failure: Failure) {
    super(failure.reason);
    this.failure = failure;
  }
}

/** What the runner gives to the agent of one job. */
export interface AgentContext {
  readonly job: ClaimedJob;
  /** The connection of the worker. An agent writes proposals through the tools of its profile
   * on this connection and writes nothing else. */
  readonly db: Queryable;
  /** One question. The call is recorded before this returns, so a proposal that follows can name
   * it. A failed question is recorded too, and it throws a ModelFailure. */
  readonly ask: <T>(question: Omit<Question<T>, 'budget'>) => Promise<Asked<T>>;
  /** The key of one act of this job, with the document and the reader filled in. */
  readonly keyOf: (parts: Omit<KeyParts, 'documentId' | 'readerId'>) => string;
}

/** One back-end agent. The runner hands it a job of its kind and ends the job itself. */
export interface RunnerAgent {
  readonly name: string;
  readonly version: string;
  readonly kind: ClaimedJob['kind'];
  readonly settings: AgentModel;
  /** The most questions one job asks. The lease must outlast this many worst questions. */
  readonly questionsPerJob: number;
  /** The soft stop of the tokens of one job. */
  readonly tokenCap: number;
  readonly run: (context: AgentContext) => Promise<void>;
}

// Departure: no agent is built yet, so the registry is empty and the runner refuses to start on
// it. An agent joins this list with its own change, and a test holds its own stubs.
export const AGENTS: readonly RunnerAgent[] = [];
