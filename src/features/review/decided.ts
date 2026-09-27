/** The history of the record, one row per decided act, in the words of the queue. It lists no
 * hold, because the record holds none, and it offers no way back: a decided act is frozen. */

import type { DecidedAct } from '@/shared/read/decided-acts';
import type { Corpus, ProposalOp, Relation } from '@/shared/read/model';

import { payloadHeadline, relationPhrase, shortId } from './act-words';
import type { DoorVerdict } from './decision';
import { originOf, type Origin } from './origin';
import { VERDICT_WORDS } from './queue';

export interface DecidedRow {
  readonly id: string;
  readonly verdict: DoorVerdict;
  readonly verdictWords: string;
  readonly actWords: string;
  /** What the act changed, named as the record names it today. */
  readonly subject: string;
  /** The keys the act names. Blank where it names none. */
  readonly keys: string;
  /** The hour as the record states it, for a machine that reads the row. */
  readonly decidedAt: string;
  readonly when: string;
  /** The name the verdict was signed with. It proves no person. */
  readonly signedAs: string;
  readonly author: Origin;
}

const VERDICT_OF: Readonly<Record<DecidedAct['verdict'], DoorVerdict>> = {
  accepted: 'promoted',
  rejected: 'rejected',
};

const ACT_WORDS: Readonly<Record<ProposalOp, string>> = {
  create_entity: 'New entity',
  create_relation: 'New relation',
  update_attrs: 'Modification',
  update_entity: 'Change of the name or the type',
  update_relation: 'Modification of a relation',
  delete_entity: 'Deletion',
  delete_relation: 'Deletion of a relation',
  merge_entities: 'Merge',
};

interface Names {
  readonly entityLabel: ReadonlyMap<string, string>;
  readonly madeFrom: ReadonlyMap<string, string>;
  readonly relationById: ReadonlyMap<string, Relation>;
}

const labelIn =
  (names: Names) =>
  (id: string): string | undefined =>
    names.entityLabel.get(id);

function relationWords(names: Names, id: string): string {
  const relation = names.relationById.get(id);
  if (relation === undefined) return `A relation absent from the record, ${shortId(id)}`;
  return relationPhrase(labelIn(names), relation.srcId, relation.type, relation.dstId);
}

// A promoted deletion takes its row out of the record, and the act kept a copy of that row. The
// copy is the one place the name of a destroyed row still stands.
function destroyedLabel(act: DecidedAct['act']): string | null {
  const prior = act.priorValue;
  if (prior?.kind !== 'row') return null;
  const label = prior.row['label'];
  return typeof label === 'string' ? label : null;
}

function subjectOf(names: Names, act: DecidedAct['act']): string {
  const payload = act.payload;
  switch (payload.kind) {
    case 'entity':
      return (
        names.madeFrom.get(act.id) ??
        payload.label ??
        `A new ${payload.type ?? 'entity'} the act does not name`
      );
    case 'relation':
    case 'merge':
      return payloadHeadline(labelIn(names), payload);
    case 'attrs':
    case 'columns':
    case 'delete': {
      if (act.targetId === null) return 'An element the act does not name';
      if (act.targetKind === 'relation') return relationWords(names, act.targetId);
      const standing = names.entityLabel.get(act.targetId);
      if (standing !== undefined) return standing;
      return destroyedLabel(act) ?? `An entity absent from the record, ${shortId(act.targetId)}`;
    }
  }
}

function keysOf(act: DecidedAct['act']): string {
  const payload = act.payload;
  if (payload.kind === 'attrs' || payload.kind === 'entity') {
    return Object.keys(payload.attrs).join(', ');
  }
  if (payload.kind === 'columns') {
    const named = [payload.label === null ? '' : 'Name', payload.type === null ? '' : 'Type'];
    return named.filter((word) => word !== '').join(', ');
  }
  return '';
}

// The hour is written in UTC and to the minute, so two analysts in two zones read one hour.
function whenOf(at: string): string {
  const moment = new Date(at);
  if (Number.isNaN(moment.getTime())) return at;
  const iso = moment.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

const momentOf = (row: DecidedRow): number => Date.parse(row.decidedAt);

/** Every decided act, the latest decision first. */
export function readDecided(corpus: Corpus, acts: readonly DecidedAct[]): readonly DecidedRow[] {
  const names: Names = {
    entityLabel: new Map(corpus.entities.map((row) => [row.id, row.label])),
    madeFrom: new Map(corpus.entities.map((row) => [row.promotedFrom, row.label])),
    relationById: new Map(corpus.relations.map((row) => [row.id, row])),
  };

  const rows = acts.map(({ act, verdict, decidedAt, decidedBy }): DecidedRow => {
    const held = VERDICT_OF[verdict];
    return {
      id: act.id,
      verdict: held,
      verdictWords: VERDICT_WORDS[held],
      actWords: ACT_WORDS[act.op],
      subject: subjectOf(names, act),
      keys: keysOf(act),
      decidedAt,
      when: whenOf(decidedAt),
      signedAs: decidedBy,
      author: originOf(act.authorRole),
    };
  });
  return [...rows].sort((a, b) => momentOf(b) - momentOf(a) || a.id.localeCompare(b.id));
}
