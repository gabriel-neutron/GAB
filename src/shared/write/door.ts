// The one request that changes the record. The address, the method, the headers, the status
// codes and the shape of the answer stay inside; a caller names an act and the body it carries.

import { WRITE_OPS } from '@gab/proposal/request';
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

const signed = z.object({
  proposalId: z.string(),
  targetId: z.string(),
  state: z.literal('signed'),
});

const refused = z.object({ refusal: z.string(), proposalId: z.string().optional() });

const readBody = async (answer: Response): Promise<unknown> => {
  try {
    return await answer.json();
  } catch {
    return undefined;
  }
};

// The status is the second witness. A body the writer did not write is a proxy or a gateway
// speaking, and a gateway times out exactly where the writer most probably finished the act.
const outcomeOf = (status: number, body: unknown): WriteOutcome => {
  const held = signed.safeParse(body);
  if (held.success)
    return { state: 'signed', proposalId: held.data.proposalId, targetId: held.data.targetId };

  const sentence = refused.safeParse(body);
  if (!sentence.success) return { state: 'unknown', doubt: unreadable(status) };

  // The act is committed and it was not signed. The writer names the proposal, and that name is
  // the only way the operator finds the act again.
  const proposalId = sentence.data.proposalId;
  if (proposalId === undefined) return { state: 'refused', refusal: sentence.data.refusal };
  return { state: 'undecided', refusal: sentence.data.refusal, proposalId };
};

/** Send one act to the writer. Every failure arrives as a sentence, and never as a raised error:
 * a screen that must report a refusal cannot report it from a catch. */
export async function sendAct(
  op: WriteOp,
  body: Readonly<Record<string, unknown>>,
): Promise<WriteOutcome> {
  let answer: Response;
  try {
    answer = await fetch(`${PREFIX}/${op.replaceAll('_', '-')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { state: 'unknown', doubt: NO_ANSWER };
  }

  return outcomeOf(answer.status, await readBody(answer));
}
