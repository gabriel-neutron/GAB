import { z } from 'zod';

/** One passage that an act cites: the words of the page between the offsets that code found. */
export interface Passage {
  readonly document: string;
  readonly title: string;
  readonly page: number;
  readonly text: string;
}

/** The passages of each act that waits and why each disputed act is disputed, or the sentence
 * that says why this page holds none. Both are private: the writer reads them as the operator,
 * and the public read API never holds them. */
export type QueuePassages =
  | {
      readonly state: 'held';
      readonly byAct: Readonly<Record<string, readonly Passage[]>>;
      readonly disputes: Readonly<Record<string, string>>;
    }
  | { readonly state: 'private'; readonly why: string };

/** The passages of one act, and why it is disputed when a check recorded a reason, as its card
 * draws them. */
export type ActPassages =
  | {
      readonly state: 'held';
      readonly passages: readonly Passage[];
      readonly dispute: string | null;
    }
  | { readonly state: 'private'; readonly why: string };

// The development server proxies this path to the writer, so the browser stays same-origin.
const DOOR = '/private/passages';

// External constraint: the writer reads the passages of at most this many acts in one request.
const PART = 1000;

const NO_WRITER =
  'The cited passages are private, and the write service on this machine did not give them.';

const answered = z.object({
  disputes: z.array(z.object({ proposalId: z.string(), reason: z.string() })),
  passages: z.array(
    z.object({
      proposalId: z.string(),
      document: z.string(),
      title: z.string(),
      page: z.number(),
      text: z.string(),
    }),
  ),
});

type Answered = z.output<typeof answered>;

const readPart = async (proposalIds: readonly string[]): Promise<Answered | null> => {
  try {
    const answer = await fetch(DOOR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalIds }),
    });
    const held = answered.safeParse(await answer.json());
    return answer.ok && held.success ? held.data : null;
  } catch {
    return null;
  }
};

/** Reads the passages of the named acts from the writer, in parts that the writer takes. It
 * raises nothing: the public page has no writer, and the review still draws every act. */
export async function readPassages(proposalIds: readonly string[]): Promise<QueuePassages> {
  const parts: (readonly string[])[] = [];
  for (let start = 0; start < proposalIds.length; start += PART)
    parts.push(proposalIds.slice(start, start + PART));
  const read = await Promise.all(parts.map(readPart));

  const byAct: Record<string, Passage[]> = {};
  const disputes: Record<string, string> = {};
  for (const part of read) {
    if (part === null) return { state: 'private', why: NO_WRITER };
    for (const { proposalId, ...passage } of part.passages)
      (byAct[proposalId] ??= []).push(passage);
    for (const { proposalId, reason } of part.disputes) disputes[proposalId] = reason;
  }
  return { state: 'held', byAct, disputes };
}

const NONE: readonly Passage[] = [];

/** The passages of one act, from the answer of the read above: one job, the read and its key.
 * An act of the operator cites no passage, and gets an empty list. */
export const passagesOf = (cited: QueuePassages, actId: string): ActPassages =>
  cited.state === 'private'
    ? cited
    : {
        state: 'held',
        passages: cited.byAct[actId] ?? NONE,
        dispute: cited.disputes[actId] ?? null,
      };
