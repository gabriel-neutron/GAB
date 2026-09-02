// The requests that change the record. The address, the method, the headers, the status codes
// and the shape of the answer stay inside; a caller names an act and the body it carries.

import { type DecisionOp, WRITE_OPS } from '@gab/proposal/request';
import { z } from 'zod';

/** The five acts the writer signs. The door of each one is derived here and named by no caller. */
export type WriteOp = (typeof WRITE_OPS)[number];

/** What one request became. `undecided` is the act that reached the record and was not signed.
 * `unknown` is the request whose result this page cannot learn: the act may have run whole. */
export type WriteOutcome =
  | { readonly state: 'signed'; readonly proposalId: string; readonly targetId: string }
  | { readonly state: 'refused'; readonly refusal: string }
  | { readonly state: 'undecided'; readonly refusal: string; readonly proposalId: string }
  | { readonly state: 'unknown'; readonly doubt: string };

// The development server proxies this path to the writer, so the browser stays same-origin.
const PREFIX = '/write';

// A dropped connection carries the request bytes with it. The writer may have signed the act
// and committed both transactions, and the browser has no witness either way.
const NO_ANSWER = 'The write service did not answer, and the act may have reached it.';

const unreadable = (status: number): string =>
  `The write service answered ${String(status)}, and this page cannot read the answer.`;

// The writer reached the record and cannot say what landed. The act may stand, so this page
// states the doubt, and it never states that nothing was written.
const NO_VERDICT =
  'The write service did not confirm the decision, and the act may have run whole.';

/** What one decision became. It landed, the record refused it and nothing was written, or this
 * page cannot learn which of the two happened. */
export type DecisionOutcome =
  | { readonly state: 'decided'; readonly proposalId: string; readonly targetId: string | null }
  | { readonly state: 'refused'; readonly refusal: string }
  | { readonly state: 'unknown'; readonly doubt: string };

const signed = z.object({
  proposalId: z.string(),
  targetId: z.string(),
  state: z.literal('signed'),
});

const decided = z.object({
  proposalId: z.string(),
  targetId: z.string().nullable(),
  state: z.literal('decided'),
});

const refused = z.object({ refusal: z.string(), proposalId: z.string().optional() });

const readBody = async (answer: Response): Promise<unknown> => {
  try {
    return await answer.json();
  } catch {
    return undefined;
  }
};

/** Every answer that is not the row the caller asked for. Both doors read it the same way. */
type Doubtful = Exclude<WriteOutcome, { readonly state: 'signed' }>;

// The status is the second witness. A body the writer did not write is a proxy or a gateway
// speaking, and a gateway times out exactly where the writer most probably finished the act.
const doubtfulOf = (status: number, body: unknown): Doubtful => {
  const sentence = refused.safeParse(body);
  if (!sentence.success) return { state: 'unknown', doubt: unreadable(status) };

  // The writer names the act again when it cannot say what landed. That name is the only way
  // the operator finds the act, and a refusal never carries one.
  const proposalId = sentence.data.proposalId;
  if (proposalId === undefined) return { state: 'refused', refusal: sentence.data.refusal };
  return { state: 'undecided', refusal: sentence.data.refusal, proposalId };
};

const outcomeOf = (status: number, body: unknown): WriteOutcome => {
  const held = signed.safeParse(body);
  if (held.success)
    return { state: 'signed', proposalId: held.data.proposalId, targetId: held.data.targetId };
  return doubtfulOf(status, body);
};

interface Answer {
  readonly status: number;
  readonly body: unknown;
}

const knock = async (
  op: WriteOp | DecisionOp,
  body: Readonly<Record<string, unknown>>,
): Promise<Answer | null> => {
  try {
    const answer = await fetch(`${PREFIX}/${op.replaceAll('_', '-')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: answer.status, body: await readBody(answer) };
  } catch {
    return null;
  }
};

/** Send one act to the writer. Every failure arrives as a sentence, and never as a raised error:
 * a screen that must report a refusal cannot report it from a catch. */
export async function sendAct(
  op: WriteOp,
  body: Readonly<Record<string, unknown>>,
): Promise<WriteOutcome> {
  const answer = await knock(op, body);
  if (answer === null) return { state: 'unknown', doubt: NO_ANSWER };
  return outcomeOf(answer.status, answer.body);
}

/** Decide one act that already waits in the record. It writes no proposal: it names one, so the
 * row it may answer with is not its own, and a doubt about it is a doubt about a verdict. */
export async function sendDecision(op: DecisionOp, proposalId: string): Promise<DecisionOutcome> {
  const answer = await knock(op, { proposalId });
  if (answer === null) return { state: 'unknown', doubt: NO_ANSWER };

  const held = decided.safeParse(answer.body);
  if (held.success)
    return { state: 'decided', proposalId: held.data.proposalId, targetId: held.data.targetId };

  // The act waits under a name that this page already holds, so the doubt of a decision needs
  // no name of its own. It stays a doubt, and it never becomes a refusal.
  const sentence = doubtfulOf(answer.status, answer.body);
  if (sentence.state === 'undecided') return { state: 'unknown', doubt: NO_VERDICT };
  return sentence;
}
