import type { Fault, FaultKind, FaultLevel } from './unit-page';

/** The short mark of one kind of fault on a line of the left column. */
export interface FaultMark {
  readonly kind: FaultKind;
  readonly level: FaultLevel;
  readonly words: string;
}

// Departure: two exports, one job. The rail of the groups counts the units of each kind of fault
// in the same short words as the marks of a line.

/** The short words of each kind of fault. */
export const FAULT_WORDS: Readonly<Record<FaultKind, string>> = {
  end_waits: 'waits',
  circle: 'circle',
  end_relation_waits: 'waits for a relation',
  end_rejected: 'end rejected',
  end_missing: 'end missing',
  self: 'points to itself',
  no_source: 'no passage',
  end_waits_in_group: 'parent first',
  dispute: 'disputed',
  contradiction: 'two values',
  reported_claim: 'reported claim',
  duplicate: 'duplicate',
  unknown_type: 'unknown type',
  rejected_before: 'rejected before',
  sources_from_parent: 'sources from the parent',
  approximate_position: 'approximate position',
  note: 'note',
  same_name: 'same name',
};

/** One mark for each kind of fault of a unit, in the order of the faults: the blocks first. */
export function faultMarks(faults: readonly Fault[]): readonly FaultMark[] {
  const marks = new Map<FaultKind, FaultMark>();
  for (const fault of faults)
    if (!marks.has(fault.kind))
      marks.set(fault.kind, {
        kind: fault.kind,
        level: fault.level,
        words: FAULT_WORDS[fault.kind],
      });
  return [...marks.values()];
}
