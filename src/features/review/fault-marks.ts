import type { Fault, FaultKind, FaultLevel } from './unit-page';

/** The short mark of one kind of fault on a line of the left column. */
export interface FaultMark {
  readonly kind: FaultKind;
  readonly level: FaultLevel;
  readonly words: string;
}

const WORDS: Readonly<Record<FaultKind, string>> = {
  end_waits: 'waits for another group',
  circle: 'circle',
  end_relation_waits: 'waits for a relation',
  end_rejected: 'end rejected',
  end_missing: 'end missing',
  self: 'points to itself',
  no_source: 'no passage',
  end_waits_in_group: 'waits for a unit of its group',
  dispute: 'disputed',
  contradiction: 'two values',
  reported_claim: 'reported claim',
  duplicate: 'duplicate',
  unknown_type: 'unknown type',
  rejected_before: 'rejected before',
  broken_value: 'broken value',
  parent_rejected: 'parent rejected',
  sources_from_parent: 'sources from the parent',
  approximate_position: 'approximate position',
  note: 'note',
  same_name: 'same name',
};

// Departure: two exports, one job. The mark on a line, the choice of the fault filter and the
// counts of the rail of the groups say one kind of fault in the same words.

/** The short words of one kind of fault. */
export const faultWords = (kind: FaultKind): string => WORDS[kind];

/** One mark for each kind of fault of a unit, in the order of the faults: the blocks first. A
 * wait for a unit of the same group has no mark: a group action writes the unit, and only Promote
 * of the unit alone waits. */
export function faultMarks(faults: readonly Fault[]): readonly FaultMark[] {
  const marks = new Map<FaultKind, FaultMark>();
  for (const fault of faults)
    if (fault.level !== 'waits' && !marks.has(fault.kind))
      marks.set(fault.kind, {
        kind: fault.kind,
        level: fault.level,
        words: WORDS[fault.kind],
      });
  return [...marks.values()];
}
