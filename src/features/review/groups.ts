import { PROPOSERS } from '@gab/proposal/proposer';
import { z } from 'zod';

import type { Proposer } from '@/shared/read/model';
import { askWriter } from '@/shared/write/door';

import { FAULT_KINDS, type FaultKind, type FaultLevel, type UnitState } from './unit-page';

// Departure: two reads, one job. The rail lists the groups, and the read of one group gives the
// units that the confirmation of the group action shows. Both are private, so both go through the
// writer.

/** One line of the rail: a group, the units that wait in it, and for each fault that keeps a
 * unit out of the group action, the count of the units that have it. */
export interface GroupLine {
  readonly id: string;
  readonly subject: string | null;
  readonly proposer: Proposer;
  readonly document: { readonly id: string; readonly title: string } | null;
  readonly units: number;
  readonly clean: number;
  readonly faults: readonly { readonly kind: FaultKind; readonly units: number }[];
}

/** One unit of a group that waits, with what the confirmation shows of it. */
export interface GroupUnit {
  readonly id: string;
  readonly kind: 'entity' | 'link' | 'change';
  readonly name: string;
  readonly type: string | null;
  readonly state: UnitState;
  readonly faults: readonly { readonly kind: FaultKind; readonly level: FaultLevel }[];
  readonly entities: number;
  readonly relations: number;
  /** The group action can write the unit: it is clean, and each unit that it needs is a clean
   * unit of the same group. */
  readonly writable: boolean;
  /** The parent of the entity, with its unit when the parent waits in the queue. */
  readonly parent: { readonly unit: string | null; readonly name: string } | null;
}

/** The units of one group that wait. */
export interface GroupUnits {
  readonly id: string;
  readonly subject: string | null;
  readonly units: readonly GroupUnit[];
}

/** A read of the writer, or the sentence that says why the page holds none. */
export type GroupsRead<Held> =
  | { readonly state: 'held'; readonly read: Held }
  | { readonly state: 'private'; readonly why: string };

const PROPOSER = z.enum(PROPOSERS);
const KIND = z.enum(FAULT_KINDS);

const rail = z.object({
  groups: z.array(
    z.object({
      id: z.string(),
      subject: z.string().nullable(),
      proposer: PROPOSER,
      document: z.object({ id: z.string(), title: z.string() }).nullable(),
      units: z.number().int(),
      clean: z.number().int(),
      faults: z.record(z.string(), z.number().int()),
    }),
  ),
});

const group = z.object({
  id: z.string(),
  subject: z.string().nullable(),
  units: z.array(
    z.object({
      unit: z.string(),
      kind: z.enum(['entity', 'link', 'change']),
      name: z.string(),
      type: z.string().nullable(),
      state: z.enum(['clean', 'not_clean', 'blocked']),
      faults: z.array(
        z.object({ kind: KIND, level: z.enum(['blocks', 'waits', 'not_clean', 'information']) }),
      ),
      entities: z.number().int(),
      relations: z.number().int(),
      writable: z.boolean(),
      parent: z.object({ unit: z.string().nullable(), name: z.string() }).nullable(),
    }),
  ),
});

const NO_WRITER =
  'The groups are private, and the write service on this machine did not give them. Start the ' +
  'write service, then open this page again.';

const lines = rail.transform((read): { readonly lines: readonly GroupLine[] } => ({
  lines: read.groups.map((line) => ({
    ...line,
    faults: Object.entries(line.faults).flatMap(([kind, units]) => {
      const known = KIND.safeParse(kind);
      return known.success ? [{ kind: known.data, units }] : [];
    }),
  })),
}));

const units = group.transform((read): { readonly units: GroupUnits } => ({
  units: {
    id: read.id,
    subject: read.subject,
    units: read.units.map(({ unit, ...held }) => ({ id: unit, ...held })),
  },
}));

/** The rail of the groups that hold a unit that waits. It raises nothing. */
export async function readGroups(): Promise<GroupsRead<readonly GroupLine[]>> {
  const read = await askWriter('/private/review-groups', {}, lines);
  return read.step === 'done'
    ? { state: 'held', read: read.lines }
    : { state: 'private', why: NO_WRITER };
}

/** The units of one group that wait. A group with no unit that waits gives the sentence of the
 * writer. It raises nothing. */
export async function readGroupUnits(groupId: string): Promise<GroupsRead<GroupUnits>> {
  const read = await askWriter('/private/review-group', { groupId }, units);
  switch (read.step) {
    case 'done':
      return { state: 'held', read: read.units };
    case 'refused':
      return { state: 'private', why: `The group cannot be read: ${read.refusal}` };
    case 'unknown':
      return { state: 'private', why: NO_WRITER };
  }
}
