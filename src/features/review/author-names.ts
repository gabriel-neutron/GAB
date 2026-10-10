import { z } from 'zod';

import { askWriter } from '@/shared/write/door';
import type { WriteResult } from '@/shared/write/write-state';

// Departure: two exports, one job. The operator reads the names that wait and decides each one.
// Both are private, so both go through the writer.

/** One name that joined an author A or B, the author, the letter of that author, and the number
 * of units that the name holds in doubt until the operator decides it. */
export interface WaitingName {
  readonly name: string;
  readonly author: string;
  readonly letter: string;
  readonly units: number;
}

/** The names that wait, or the sentence that says why the page holds none. */
export type NamesRead =
  | { readonly state: 'held'; readonly names: readonly WaitingName[] }
  | { readonly state: 'private'; readonly why: string };

const NO_WRITER =
  'The names that wait are private, and the write service on this machine did not give them. ' +
  'Start the write service, then open this page again.';

const waiting = z.object({
  names: z.array(
    z.object({ name: z.string(), author: z.string(), letter: z.string(), units: z.number() }),
  ),
});

/** Reads the names that wait for the operator. It raises nothing. */
export async function readAuthorNames(): Promise<NamesRead> {
  const read = await askWriter('/private/author-names', {}, waiting);
  switch (read.step) {
    case 'done':
      return { state: 'held', names: read.names };
    case 'refused':
      return { state: 'private', why: `The names cannot be read: ${read.refusal}` };
    case 'unknown':
      return { state: 'private', why: NO_WRITER };
  }
}

/** Confirm or refuse one name that waits. The answer is the number of units that the rules
 * decided again. A lost answer is a doubt: the decision may stand. */
export const decideAuthorName = (
  name: string,
  confirm: boolean,
): Promise<WriteResult<{ readonly units: number }>> =>
  askWriter('/write/decide-author-name', { name, confirm }, z.object({ units: z.number() }));
