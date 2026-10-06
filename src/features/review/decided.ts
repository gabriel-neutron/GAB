/** The history of the record, one row per decided act, in the words of the queue. It lists no
 * hold, because the record holds none, and it offers no way back: a decided act is frozen. */

import type { DecidedAct } from '@/shared/read/decided-acts';
import type { Corpus, EndpointKind, ProposalOp, Relation } from '@/shared/read/model';
import { relationWording } from '@/shared/relation-words';

import { payloadHeadline, relationPhrase, shortId, type TypeWordsOf } from './act-words';
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
  readonly typeWordsOf: TypeWordsOf;
}

const labelIn =
  (names: Names) =>
  (id: string): string | undefined =>
    names.entityLabel.get(id);

// Departure: a promoted deletion takes its row out of the record, and the act kept a copy of that
// row. The copy is the one place the name of a destroyed row still stands.
function destroyedLabel(act: DecidedAct['act']): string | null {
  const prior = act.priorValue;
  if (prior?.kind !== 'row') return null;
  const label = prior.row['label'];
  return typeof label === 'string' ? label : null;
}

// Origin: an end kind the copy does not state is 'entity', the default of the column.
const endKind = (value: unknown): EndpointKind => (value === 'relation' ? 'relation' : 'entity');

function destroyedRelation(names: Names, act: DecidedAct['act']): string | null {
  const prior = act.priorValue;
  if (prior?.kind !== 'row') return null;
  const { row } = prior;
  const type = row['type'];
  const srcId = row['src_id'];
  const dstId = row['dst_id'];
  if (typeof type !== 'string' || typeof srcId !== 'string' || typeof dstId !== 'string') {
    return null;
  }
  return relationPhrase(
    labelIn(names),
    names.typeWordsOf,
    { kind: endKind(row['src_kind']), id: srcId },
    type,
    { kind: endKind(row['dst_kind']), id: dstId },
  );
}

function relationWords(names: Names, act: DecidedAct['act'], id: string): string {
  const relation = names.relationById.get(id);
  if (relation === undefined) {
    return destroyedRelation(names, act) ?? `A relation absent from the record, ${shortId(id)}`;
  }
  return relationPhrase(
    labelIn(names),
    names.typeWordsOf,
    { kind: relation.srcKind, id: relation.srcId },
    relation.type,
    { kind: relation.dstKind, id: relation.dstId },
  );
}

function subjectOf(names: Names, act: DecidedAct['act']): string {
  const payload = act.payload;
  switch (payload.kind) {
    case 'entity':
      return names.madeFrom.get(act.id) ?? payload.label;
    case 'relation':
    case 'merge':
      return payloadHeadline(labelIn(names), names.typeWordsOf, payload);
    case 'attrs':
    case 'columns':
    case 'delete': {
      if (act.targetId === null) return 'An element the act does not name';
      if (act.targetKind === 'relation') return relationWords(names, act, act.targetId);
      const standing = names.entityLabel.get(act.targetId);
      if (standing !== undefined) return standing;
      return destroyedLabel(act) ?? `An entity absent from the record, ${shortId(act.targetId)}`;
    }
  }
}

const named = (words: readonly (string | false)[]): string =>
  words.filter((word) => word !== false).join(', ');

function keysOf(act: DecidedAct['act']): string {
  const payload = act.payload;
  switch (payload.kind) {
    case 'attrs':
      return named(Object.keys(payload.attrs));
    case 'columns':
      return named([payload.label !== null && 'Name', payload.type !== null && 'Type']);
    case 'entity':
      return named([
        'Name',
        'Type',
        payload.geom !== null && 'Location',
        ...Object.keys(payload.attrs),
      ]);
    case 'relation':
      return named([
        'Type',
        payload.valid_from !== null && 'Valid from',
        payload.valid_to !== null && 'Valid to',
        ...Object.keys(payload.attrs),
      ]);
    case 'merge':
    case 'delete':
      return '';
  }
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
  const wordsOf = relationWording(corpus.relationTypes);
  const names: Names = {
    entityLabel: new Map(corpus.entities.map((row) => [row.id, row.label])),
    madeFrom: new Map(corpus.entities.map((row) => [row.promotedFrom, row.label])),
    relationById: new Map(corpus.relations.map((row) => [row.id, row])),
    typeWordsOf: (type) => wordsOf(type).label,
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
