import { unitChanges, type RelationLine, type UnitWords } from './unit-changes';
import type { Unit } from './unit-page';

/** What each control says before the click: what Promote writes, and what Reject rejects. */
export interface DecisionWords {
  readonly promote: string;
  readonly reject: string;
}

const relations = (count: number): string =>
  `${String(count)} ${count === 1 ? 'relation' : 'relations'}`;

const lineWords = (line: RelationLine): string =>
  `${line.from === null ? '' : `${line.from} `}${line.word} → ${line.other}`;

/** The words of the decision on one unit. `aimed` names the one relation that Reject rejects
 * alone, or null when Reject rejects the whole unit. */
export function decisionWords(unit: Unit, words: UnitWords, aimed: string | null): DecisionWords {
  const { entity, relations: lines } = unitChanges(unit, words);
  const source = unit.documents.map((document) => document.title).join('; ') || 'no document';
  const relation = lines.length === 1 && lines[0] !== undefined ? lineWords(lines[0]) : null;
  const subject =
    entity !== null
      ? `${entity.name} (${entity.type}) and ${relations(lines.length)}`
      : relation !== null
        ? `the relation ${relation}`
        : unit.name;
  const aimedLine = lines.find((line) => line.id === aimed);
  return {
    promote: `Writes ${subject}. Source: ${source}. You cannot undo this.`,
    reject:
      aimedLine !== undefined
        ? `Rejects the relation ${lineWords(aimedLine)}. The rest of the unit stays in the queue.`
        : entity !== null
          ? `Rejects ${entity.name} and its ${relations(lines.length)}.`
          : `Rejects ${relation === null ? unit.name : `the relation ${relation}`}.`,
  };
}
