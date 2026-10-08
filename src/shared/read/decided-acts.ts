// The acts the record has promoted, read once and held as the corpus is held. The corpus reads
// the pending acts only, so this is the one read of the history. A corpus refresh forgets it. The
// public read shows no rejected act, so the history holds the promoted acts only.

import { readRows } from './http';
import { toDomain } from './map';
import type { Proposal } from './model';
import { readOnce } from './once';

/** One act the record promoted. A decided act always carries its hour and the name that signed
 * it, so an act without them cannot be built here. The record keeps no reason for a verdict. */
export interface DecidedAct {
  readonly act: Omit<Proposal, 'status' | 'decidedAt' | 'decidedBy' | 'decidedAs'>;
  readonly verdict: 'accepted';
  readonly decidedAt: string;
  readonly decidedBy: string;
  /** One unit, one relation or a group action. An older decision has none. */
  readonly decidedAs: Proposal['decidedAs'];
}

function decidedOf(row: unknown): DecidedAct {
  const { status, decidedAt, decidedBy, decidedAs, ...act } = toDomain.proposal(row);
  // The table pairs a decided status with an hour and a name. A row that breaks the pair broke
  // the contract of the read, and it stops here and never reaches a screen as a blank.
  if (status !== 'accepted' || decidedAt === null || decidedBy === null) {
    throw new Error(
      `The read API gave the decided act ${act.id} without its verdict, its hour or its name.`,
    );
  }
  return { act, verdict: status, decidedAt, decidedBy, decidedAs };
}

async function read(): Promise<readonly DecidedAct[]> {
  const accepted = await readRows('proposal', { status: 'accepted' });
  return accepted.map((row) => decidedOf(row));
}

const memory = readOnce(read);

export const loadDecidedActs = memory.load;

export const forgetDecidedActs = memory.forget;
