// The requests that change the record. The address, the method, the headers, the status codes
// and the shape of the answer stay inside; a caller names an act and the body it carries.

import { type BatchVerdict, type DecisionOp, type WRITE_OPS } from '@gab/proposal/request';
import { z } from 'zod';

import type { WriteResult } from './write-state';

/** The six acts the writer signs. The door of each one is derived here and named by no caller. */
type WriteOp = (typeof WRITE_OPS)[number];

/** What a signed act wrote: one proposal, and the row it promoted. */
export interface Signed {
  readonly proposalId: string;
  readonly targetId: string;
}

// A dropped connection carries the request bytes with it. The writer may have written the act,
// and the browser has no witness either way.
const NO_ANSWER = 'The write service did not answer, and the act may have reached it.';

const unreadable = (status: number): string =>
  `The write service answered ${String(status)}, and this page cannot read the answer.`;

// The writer reached the record and lost its answer. The act may stand, so this page states the
// doubt, and it never states that nothing was written.
const UNCONFIRMED = 'The write service did not confirm the act, and the act may have run whole.';

const signed = z.object({ proposalId: z.string(), targetId: z.string() });

// A decision answers no row that the screen reads, so its done step carries nothing.
const decided = z.object({ state: z.literal('decided') }).transform(() => ({}));

const refused = z.object({ refusal: z.string() });

const doubted = z.object({ doubt: z.string() });

const readBody = async (answer: Response): Promise<unknown> => {
  try {
    return await answer.json();
  } catch {
    return undefined;
  }
};

/** Every answer that is not the row the caller asked for. Each door reads it the same way. */
type Unwritten = Exclude<WriteResult, { readonly step: 'done' }>;

// External constraint: the status is the second witness. A body the writer did not write is a
// proxy or a gateway speaking, and a gateway times out where the writer most probably finished.
const unwrittenOf = (status: number, body: unknown): Unwritten => {
  if (doubted.safeParse(body).success) return { step: 'unknown', doubt: UNCONFIRMED };
  const sentence = refused.safeParse(body);
  if (!sentence.success) return { step: 'unknown', doubt: unreadable(status) };
  return { step: 'refused', refusal: sentence.data.refusal };
};

interface Answer {
  readonly status: number;
  readonly body: unknown;
}

// The development server proxies each address to the writer, so the browser stays same-origin.
const knock = async (
  address: string,
  body: Readonly<Record<string, unknown>>,
): Promise<Answer | null> => {
  try {
    const answer = await fetch(address, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: answer.status, body: await readBody(answer) };
  } catch {
    return null;
  }
};

/** Ask one door of the writer, and read its answer through `done`. Every failure arrives as a
 * sentence, and never as a raised error: a screen that must report a refusal cannot report it
 * from a catch. A lost answer is a doubt, because the act may have run whole. */
export async function askWriter<Done extends object>(
  address: string,
  body: Readonly<Record<string, unknown>>,
  done: z.ZodType<Done>,
): Promise<WriteResult<Done>> {
  const answer = await knock(address, body);
  if (answer === null) return { step: 'unknown', doubt: NO_ANSWER };
  const held = done.safeParse(answer.body);
  if (held.success) return { step: 'done', ...held.data };
  return unwrittenOf(answer.status, answer.body);
}

const doorOf = (op: WriteOp | DecisionOp): string => `/write/${op.replaceAll('_', '-')}`;

/** Send one act to the writer. */
export const sendAct = (
  op: WriteOp,
  body: Readonly<Record<string, unknown>>,
): Promise<WriteResult<Signed>> => askWriter(doorOf(op), body, signed);

/** Decide one act that already waits in the record. It writes no proposal: it names one, so a
 * doubt about it is a doubt about a verdict. */
export const sendDecision = (op: DecisionOp, proposalId: string): Promise<WriteResult> =>
  askWriter(doorOf(op), { proposalId }, decided);

/** Decide every act of one linked batch as one unit. A refusal names the act that the record
 * refused, and nothing of the batch was written. */
export const sendBatchDecision = (batchId: string, verdict: BatchVerdict): Promise<WriteResult> =>
  askWriter('/write/decide-batch', { batchId, verdict }, decided);

/** One file and the fields its document row records. The content is the file in base64. */
export interface UploadBody {
  readonly fileName: string;
  readonly title: string;
  readonly content: string;
  readonly retrievedAt: string;
  readonly uri?: string;
  readonly providerId?: string;
  readonly costEur?: number;
}

/** What one upload stored. A known file is already a document, and its id is the one that holds
 * the bytes. */
export type Uploaded =
  | {
      readonly document: 'stored';
      readonly documentId: string;
      readonly emptyPages: readonly number[];
    }
  | { readonly document: 'known'; readonly documentId: string };

const uploaded = z.object({
  state: z.enum(['stored', 'known']),
  documentId: z.string(),
  emptyPages: z.array(z.number()),
});

// External constraint: the writer answers 503 when the store or the record did not answer, and
// the file may stand in the record. The same bytes are never stored twice, so a resend is safe.
const UNAVAILABLE = 503;

/** Send one file to the writer. Every failure arrives as a sentence, and never as an error. */
export async function uploadDocument(body: UploadBody): Promise<WriteResult<Uploaded>> {
  const answer = await knock('/write/upload-document', { ...body });
  if (answer === null) return { step: 'unknown', doubt: NO_ANSWER };

  const held = uploaded.safeParse(answer.body);
  if (held.success)
    return held.data.state === 'stored'
      ? {
          step: 'done',
          document: 'stored',
          documentId: held.data.documentId,
          emptyPages: held.data.emptyPages,
        }
      : { step: 'done', document: 'known', documentId: held.data.documentId };

  const sentence = refused.safeParse(answer.body);
  if (!sentence.success) return { step: 'unknown', doubt: unreadable(answer.status) };
  if (answer.status === UNAVAILABLE) return { step: 'unknown', doubt: sentence.data.refusal };
  return { step: 'refused', refusal: sentence.data.refusal };
}
