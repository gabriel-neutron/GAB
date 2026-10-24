// The accepted act that an entity names as its promotion, read once for each act and held as the
// corpus is held. The corpus reads the pending acts only. The history of acts only grows, so the
// read asks for the one act by its identifier and never for the whole history. A corpus refresh
// forgets every held act. The public read shows no rejected act, so only a promoted act is read.

import { z } from 'zod';

import { readRows } from './http';
import { toDomain } from './map';
import type { Proposal } from './model';
import { readOnce } from './once';
import { readFrom } from './read-mode';

/** One act the record promoted. A decided act always carries its hour and the name that signed
 * it, so an act without them cannot be built here. The record keeps no reason for a verdict. */
export interface DecidedAct {
  readonly act: Omit<
    Proposal,
    'status' | 'decidedAt' | 'decidedBy' | 'decidedAs' | 'decisionOrigin' | 'originLabel'
  >;
  readonly verdict: 'accepted';
  readonly decidedAt: string;
  readonly decidedBy: string;
  /** One unit, one relation, a group action or a rule. An older decision has none. */
  readonly decidedAs: Proposal['decidedAs'];
  readonly decisionOrigin: Proposal['decisionOrigin'];
  /** The label of the claim, in the fixed words of the record (PU1). */
  readonly originLabel: Proposal['originLabel'];
}

/** One accepted act that this read cannot build. It stays as one marked line, so one act of an
 * unknown shape never fails a page. */
export interface UnreadAct {
  readonly unreadable: true;
  readonly id: string;
}

/** One line of the history: an act that was read, or an act that was not. */
export type DecidedLine = DecidedAct | UnreadAct;

/** True when the act of the history could not be read. */
export const isUnread = (held: DecidedLine): held is UnreadAct => 'unreadable' in held;

/** The identifier of the act of a line. */
export const idOf = (held: DecidedLine): string => (isUnread(held) ? held.id : held.act.id);

const rowId = z.looseObject({ id: z.string() });

function decidedOf(row: unknown): DecidedAct {
  const { status, decidedAt, decidedBy, decidedAs, decisionOrigin, originLabel, ...act } =
    toDomain.proposal(row);
  // The table pairs a decided status with an hour and a name. A row that breaks the pair broke
  // the contract of the read, and it stops here and never reaches a screen as a blank.
  if (status !== 'accepted' || decidedAt === null || decidedBy === null) {
    throw new Error(
      `The read API gave the decided act ${act.id} without its verdict, its hour or its name.`,
    );
  }
  return { act, verdict: status, decidedAt, decidedBy, decidedAs, decisionOrigin, originLabel };
}

function lineOf(row: unknown): DecidedLine {
  try {
    return decidedOf(row);
  } catch {
    const id = rowId.safeParse(row);
    return { unreadable: true, id: id.success ? id.data.id : '' };
  }
}

// The list holds the one act that the identifier names, or nothing where the record has no such
// accepted act.
async function read(actId: string): Promise<readonly DecidedLine[]> {
  const accepted = await readRows('proposal', { id: actId, status: 'accepted' });
  return accepted.map((row) => lineOf(row));
}

function memoryFor(actId: string) {
  return readOnce(() =>
    readFrom(
      () => read(actId),
      () => Promise.resolve([]),
    ),
  );
}

const held = new Map<string, ReturnType<typeof memoryFor>>();

function memoryOf(actId: string): ReturnType<typeof memoryFor> {
  const own = held.get(actId);
  if (own !== undefined) return own;
  // A release holds no history of acts, so the page shows the record without a decision line.
  const made = memoryFor(actId);
  held.set(actId, made);
  return made;
}

/** The accepted act with this identifier: the `promotedFrom` of an entity. */
export const loadDecidedActs = (actId: string): Promise<readonly DecidedLine[]> =>
  memoryOf(actId).load();

export const forgetDecidedActs = (): void => {
  held.clear();
};
