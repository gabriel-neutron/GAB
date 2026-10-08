import type { Decision } from '@gab/proposal/request';

import type { Written } from '@/shared/write/door';

import { REJECTION_REASONS } from './rejection';

const reasonWords = (key: string): string =>
  REJECTION_REASONS.find((reason) => reason.key === key)?.words ?? key;

const counted = (count: number, one: string, many: string): string =>
  `${String(count)} ${count === 1 ? one : many}`;

// A unit of one relation, and a relation rejected alone, are named as the relation.
const nameOf = (written: Written, decision: Decision): string =>
  decision.op === 'reject_relation' || (written.entities === 0 && written.relations === 1)
    ? `the relation ${written.name}`
    : written.name || 'the unit';

/** The one line that says what a decision did, from what the record answered that it wrote or
 * rejected. The note of a rejection is not repeated. */
export function decisionDone(decision: Decision, written: Written): string {
  const name = nameOf(written, decision);
  if (decision.op !== 'promote_unit') return `Rejected ${name}: ${reasonWords(decision.reason)}.`;
  const relations = written.entities === 0 ? 0 : written.relations;
  return relations === 0
    ? `Promoted ${name}.`
    : `Promoted ${name} and ${counted(relations, 'relation', 'relations')}.`;
}
