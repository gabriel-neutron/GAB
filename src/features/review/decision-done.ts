import type { Decision } from '@gab/proposal/request';

import { REJECTION_REASONS } from './rejection';
import { unitChanges, type RelationLine, type UnitWords } from './unit-changes';
import type { Unit } from './unit-page';

const lineWords = (line: RelationLine): string =>
  `the relation ${line.from === null ? '' : `${line.from} `}${line.word} → ${line.other}`;

const reasonWords = (key: string): string =>
  REJECTION_REASONS.find((reason) => reason.key === key)?.words ?? key;

/** The one line that says what a decision on a unit did, after the record took it. The note of a
 * rejection is not repeated. */
export function decisionDone(unit: Unit, words: UnitWords, decision: Decision): string {
  const { entity, relations } = unitChanges(unit, words);
  const only = relations.length === 1 && relations[0] !== undefined ? relations[0] : null;
  const name =
    entity !== null ? entity.name : only !== null ? lineWords(only) : unit.name || 'the unit';
  switch (decision.op) {
    case 'promote_unit': {
      const count = entity === null ? 0 : relations.length;
      return count === 0
        ? `Promoted ${name}.`
        : `Promoted ${name} and ${String(count)} ${count === 1 ? 'relation' : 'relations'}.`;
    }
    case 'reject_unit':
      return `Rejected ${name}: ${reasonWords(decision.reason)}.`;
    case 'reject_relation': {
      const line = relations.find((held) => held.id === decision.proposalId);
      return `Rejected ${line === undefined ? 'a relation' : lineWords(line)}: ${reasonWords(decision.reason)}.`;
    }
  }
}
