import { withFullStop } from './full-stop';
import { REJECTION_REASONS } from './rejection';
import { unitChanges, type RelationLine, type UnitWords } from './unit-changes';
import type { Fault, Unit } from './unit-page';

/** What each control says before the click: what Promote writes, or why it cannot write the
 * unit, what Reject rejects, and the reasons that the rejection can give. */
export interface DecisionWords {
  readonly promote: { readonly kind: 'writes' | 'blocked'; readonly said: string };
  readonly reject: string;
  readonly reasons: readonly (typeof REJECTION_REASONS)[number][];
}

const relations = (count: number): string =>
  `${String(count)} ${count === 1 ? 'relation' : 'relations'}`;

const lineWords = (line: RelationLine): string =>
  `${line.from === null ? '' : `${line.from} `}${line.word} → ${line.other}`;

// The check names each entity of the same name and type, and where it stands, in one sentence.
const IN_RECORD = ' is in the record';

/** The name of an entity of the record with the same name and type, from the fault of the
 * duplicate. Null where only the queue holds the twin. */
const twinInRecord = (faults: readonly Fault[]): string | null => {
  const said = faults.find((fault) => fault.kind === 'duplicate')?.said;
  if (said === undefined) return null;
  const held = said
    .slice(said.indexOf(': ') + 2)
    .split('; ')
    .find((twin) => twin.endsWith(IN_RECORD));
  return held === undefined ? null : held.slice(0, -IN_RECORD.length);
};

/** The words of the decision on one unit. `aimed` names the one relation that Reject rejects
 * alone, or null when Reject rejects the whole unit. */
export function decisionWords(unit: Unit, words: UnitWords, aimed: string | null): DecisionWords {
  const { entity, relations: lines } = unitChanges(unit, words);
  const relation = lines.length === 1 && lines[0] !== undefined ? lineWords(lines[0]) : null;
  // An entity with no relation is named alone.
  const withLines = (name: string): string =>
    lines.length === 0 ? name : `${name} and ${relations(lines.length)}`;
  const subject =
    entity !== null
      ? withLines(`${entity.name} (${entity.type})`)
      : relation !== null
        ? `the relation ${relation}`
        : unit.name;
  const aimedLine = lines.find((line) => line.id === aimed);
  // A wait for an entity of the same group stops Promote of this unit alone, as a block does.
  const blocks = unit.faults.filter((fault) => fault.level === 'blocks' || fault.level === 'waits');
  const twin = entity === null ? null : twinInRecord(unit.faults);
  const second =
    entity === null || twin === null
      ? ''
      : `A second ${entity.name} will be written; ${twin} is already in the record. `;
  // The reason "end rejected" fits only the act, or the unit, whose other end was rejected.
  const endRejected =
    aimed === null
      ? unit.endRejected
      : unit.acts.some((act) => act.id === aimed && act.endRejected);
  return {
    promote:
      blocks.length === 0
        ? {
            kind: 'writes',
            said: `${second}Writes ${subject}. You cannot undo this.`,
          }
        : {
            kind: 'blocked',
            said: `Promote is not possible. ${blocks.map((fault) => withFullStop(fault.said)).join(' ')}`,
          },
    reject:
      aimedLine !== undefined
        ? `Rejects the relation ${lineWords(aimedLine)}. The rest of the unit stays in the queue.`
        : entity !== null
          ? `Rejects ${lines.length === 0 ? entity.name : `${entity.name} and its ${relations(lines.length)}`}.`
          : `Rejects ${relation === null ? unit.name : `the relation ${relation}`}.`,
    reasons: REJECTION_REASONS.filter((reason) => reason.key !== 'end_rejected' || endRejected),
  };
}
