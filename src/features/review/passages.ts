import { z } from 'zod';

/** One passage that an act cites: the words of the page between the offsets that code found. */
export interface Passage {
  readonly document: string;
  readonly title: string;
  readonly page: number;
  readonly text: string;
}

/** The passages of each act that waits, or the sentence that says why this page holds none. The
 * text of a document is private: the writer reads it as the operator, and the public read API
 * never holds it. */
export type CitedPassages =
  | { readonly state: 'held'; readonly byAct: Readonly<Record<string, readonly Passage[]>> }
  | { readonly state: 'private'; readonly why: string };

/** The passages of one act, as its card draws them. */
export type ActPassages =
  | { readonly state: 'held'; readonly passages: readonly Passage[] }
  | { readonly state: 'private'; readonly why: string };

// The development server proxies this path to the writer, so the browser stays same-origin.
const DOOR = '/private/passages';

const NO_WRITER =
  'The cited passages are private, and the write service on this machine did not give them.';

const answered = z.object({
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

/** Reads the passages of the named acts from the writer. It raises nothing: the public page has
 * no writer, and the review still draws every act. */
export async function readPassages(proposalIds: readonly string[]): Promise<CitedPassages> {
  try {
    const answer = await fetch(DOOR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalIds }),
    });
    const held = answered.safeParse(await answer.json());
    if (!answer.ok || !held.success) return { state: 'private', why: NO_WRITER };
    const byAct: Record<string, Passage[]> = {};
    for (const { proposalId, ...passage } of held.data.passages)
      (byAct[proposalId] ??= []).push(passage);
    return { state: 'held', byAct };
  } catch {
    return { state: 'private', why: NO_WRITER };
  }
}

const NONE: readonly Passage[] = [];

/** The passages of one act, from the answer of the read above: one job, the read and its key.
 * An act of the operator cites no passage, and gets an empty list. */
export const passagesOf = (cited: CitedPassages, actId: string): ActPassages =>
  cited.state === 'private' ? cited : { state: 'held', passages: cited.byAct[actId] ?? NONE };
