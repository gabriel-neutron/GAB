/** The eight ways one question to the model stops. Not one of them keeps a part answer. */
export const REASON = {
  network: 'network',
  rejected: 'rejected',
  refused: 'refused',
  credits: 'credits',
  tooLong: 'too_long',
  truncated: 'truncated',
  overCap: 'over_cap',
  configuration: 'configuration',
} as const;

export type ReasonKind = (typeof REASON)[keyof typeof REASON];

// Every sentence the operator reads is owned here. A message the model service composes names
// the upstream provider and the account, and neither of those two may reach a job record.
const SENTENCE: Readonly<Record<ReasonKind, string>> = {
  network: 'the model service did not answer, and nothing was written',
  rejected: 'the model gave an answer the boundary refuses, and nothing was written',
  refused: 'the model refused to answer, and nothing was written',
  credits: 'the model account has no credit left, and nothing was written',
  too_long: 'the document is longer than the window of the model, and no part of it was read',
  truncated: 'the answer stopped at the token limit, and a part answer is not kept',
  over_cap: 'the token cap of this job is spent, and nothing was written',
  configuration:
    'the model service refused the call. Examine the key, the model name and the account',
};

export interface Failure {
  readonly kind: ReasonKind;
  readonly reason: string;
  readonly attempts: number;
  readonly detail?: string | undefined;
}

/** One failure, with the raw cause written to the log and never to the record. */
export const failureOf = (
  kind: ReasonKind,
  attempts: number,
  cause?: unknown,
  detail?: string,
): Failure => {
  if (cause !== undefined) console.error('the model service failed', { kind, cause });
  return { kind, reason: SENTENCE[kind], attempts, detail };
};

// A fetch fault gives the same two words for every cause, and the cause under it names the
// socket, the name service or the certificate.
/** The sentence of a thrown transport fault, kept for the log alone. */
export const sentenceOf = (cause: unknown): string => {
  if (!(cause instanceof Error))
    return typeof cause === 'string' ? cause : 'the call ended with no message';

  const under = cause.cause;
  if (under instanceof Error && under.message !== '') return `${cause.message}: ${under.message}`;
  return cause.message;
};
