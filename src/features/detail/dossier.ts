/** A router loader returns these shapes, so they carry arrays and no `Map`. */

import { positionFromWords, relationLines } from '@/shared/canvas-label';
import type {
  AuthorRole,
  Corpus,
  DocId,
  DocumentRow,
  Entity,
  EndpointKind,
  Proposal,
  Relation,
  TypeVocabulary,
} from '@/shared/read/model';

import { readBand, readRating } from '@/shared/read/rating';
import { relationWording, type RelationWords } from '@/shared/relation-words';

import { readClaims, type ClaimRow } from './claims';

/** One cited document, at the position it was first met. The badge is a number and not a score:
 * one score repeated on twenty claims reads as a score for each claim. */
export interface SourceRef {
  readonly id: DocId;
  /** 1-based, and the position in the page order. */
  readonly number: number;
  /** The accessible name of the mark: `Source 7 — <title>`. It says which document (M8) and no
   * more: a score here repeats once for each claim the document holds up. */
  readonly name: string;
}

export interface ClaimLine {
  readonly key: string;
  readonly label: string;
  readonly text: string;
}

export interface SourceCardModel {
  readonly id: DocId;
  readonly number: number;
  readonly title: string;
  /** Invariant 6: false only when the rating and its origin are both absent. */
  readonly rated: boolean;
  /** `not rated` when it is not rated. Never a dash, never `0`. */
  readonly score: string;
  readonly scoreOrigin: string;
  /** A low letter or a high figure. The hue marks this, and never the absence of a rating. */
  readonly poor: boolean;
  /** What the card stands for, in one word: `missing`, a rating, `not rated`, or
   * `rating incomplete`. A check reads this, and the hue alone never says it. */
  readonly band: string;
  readonly uri: string | null;
  readonly uriShort: string | null;
  readonly retrievedAt: string | null;
  readonly holdsUp: readonly ClaimLine[];
  /** Cited, and with no row in `documents`. It is drawn and never hidden: a surface that drops
   * evidence in silence is worse than one that says what it dropped. */
  readonly missing: boolean;
}

export interface RecordRow {
  readonly claim: ClaimRow;
  readonly sources: readonly SourceRef[];
}

export interface RelationLine {
  readonly id: string;
  readonly sentence: string;
  /** M6: written at both ends, and a closed interval never reads as current. */
  readonly interval: string | null;
  /** The mark of an M4 relation comes from the relation, never from the list. */
  readonly undrawable: boolean;
  readonly sources: readonly SourceRef[];
}

export interface PendingLine {
  readonly id: string;
  readonly summary: string;
  readonly dissent: boolean;
  /** Already formatted, and a sentence where the act states none. A `.tsx` here calls no
   * `toFixed`. */
  readonly confidence: string;
  readonly origin: 'machine' | 'operator';
  readonly sources: readonly SourceRef[];
}

/** One entity the analyst may put at the other end of a new relation. `name` is the word on the
 * option, and it is composed here so that no component joins a label to a type. */
export interface LinkTarget {
  readonly id: string;
  readonly name: string;
}

/** What the new-relation form offers. `types` is what the corpus already carries. A word that
 * no live type holds is still sent, and the promotion keeps it beside the fallback type. */
export interface LinkChoices {
  readonly types: readonly string[];
  readonly targets: readonly LinkTarget[];
}

interface TypeChoice {
  readonly key: string;
  readonly name: string;
}

export interface Dossier {
  readonly entityId: string;
  readonly label: string;
  readonly type: string;
  /** The word the extraction wrote, kept when it was not a live type. The row stands as
   * `unknown`, and the word must reach the screen or the entry is lost to the reader. */
  readonly proposedType: string | null;
  /** The resolved position decides this, and never `Entity.geom`: an entity that inherits its
   * point carries no geometry of its own AND the map draws it. A link to the map for an entity
   * the map draws nowhere opens a surface that selects nothing. */
  readonly drawnOnMap: boolean;
  /** Departure: `position from <parent label>`, `position from a parent` when the list lacks it,
   * or null at its own point. The panel draws no canvas, so these words are the only place it
   * can state a borrowed position. */
  readonly positionFrom: string | null;
  readonly rows: readonly RecordRow[];
  readonly entitySources: readonly SourceRef[];
  readonly sources: readonly SourceCardModel[];
  readonly relations: readonly RelationLine[];
  readonly pending: readonly PendingLine[];
  readonly linkChoices: LinkChoices;
  /** A retired type the entity holds stays offered, or the chooser would draw a type the entity
   * does not hold. */
  readonly typeChoices: readonly TypeChoice[];
}

/** A long address does not fit a two-line card, so the card carries a short form too. */
const URI_LENGTH = 44;

const OP_WORDS: Readonly<Record<Proposal['op'], string>> = {
  create_entity: 'Creates an entity',
  update_attrs: 'Changes an attribute',
  update_entity: 'Changes the name or the type',
  delete_entity: 'Deletes an entity',
  create_relation: 'Creates a relation',
  update_relation: 'Changes a relation',
  delete_relation: 'Deletes a relation',
  merge_entities: 'Merges entities',
};

const ORIGIN_WORDS: Readonly<Record<AuthorRole, PendingLine['origin']>> = {
  gabriel_agent: 'machine',
  gabriel_research: 'machine',
  gabriel_app: 'operator',
};

function keysOf(payload: Proposal['payload']): readonly string[] {
  if (payload.kind === 'attrs') return readClaims(payload.attrs).map((claim) => claim.label);
  if (payload.kind !== 'columns') return [];
  return [
    ...(payload.label === null ? [] : [`name ${payload.label}`]),
    ...(payload.type === null ? [] : [`type ${payload.type}`]),
  ];
}

function shorten(uri: string | null): string | null {
  if (uri === null) return null;
  const bare = uri.replace(/^https?:\/\//, '');
  return bare.length <= URI_LENGTH ? bare : `${bare.slice(0, URI_LENGTH - 1)}…`;
}

interface Index {
  readonly entityById: ReadonlyMap<string, Entity>;
  readonly relationById: ReadonlyMap<string, Relation>;
  readonly wordsOf: (type: string) => RelationWords;
}

function indexOf(read: Corpus): Index {
  return {
    entityById: new Map(read.entities.map((row) => [row.id, row])),
    relationById: new Map(read.relations.map((row) => [row.id, row])),
    wordsOf: relationWording(read.relationTypes),
  };
}

function cardOf(
  ref: SourceRef,
  row: DocumentRow | undefined,
  holdsUp: readonly ClaimLine[],
): SourceCardModel {
  const rating = readRating(row);
  return {
    id: ref.id,
    number: ref.number,
    title: titleOf(ref.id, row),
    rated: rating.rated,
    score: rating.score,
    scoreOrigin: rating.scoreOrigin,
    poor: rating.poor,
    band: readBand(row),
    uri: row?.uri ?? null,
    uriShort: shorten(row?.uri ?? null),
    retrievedAt: row?.retrievedAt ?? null,
    holdsUp,
    missing: row === undefined,
  };
}

function titleOf(id: DocId, row: DocumentRow | undefined): string {
  return row?.title ?? `Cited document ${id}, absent from the record`;
}

interface SourceRegister {
  readonly refsOf: (ids: readonly DocId[]) => readonly SourceRef[];
  readonly cards: (holdsUpOf: (id: DocId) => readonly ClaimLine[]) => readonly SourceCardModel[];
}

// Departure: a document keeps the number of the list where it is first met, so the call order
// of `refsOf` is the page order. A document cited twice is one mark and one card: two entries
// would draw one key twice, and would count the evidence twice.
function sourceRegister(documentById: ReadonlyMap<DocId, DocumentRow>): SourceRegister {
  const met = new Map<DocId, SourceRef>();
  const refOf = (id: DocId): SourceRef => {
    const held = met.get(id);
    if (held !== undefined) return held;
    const number = met.size + 1;
    const made: SourceRef = {
      id,
      number,
      name: `Source ${number} — ${titleOf(id, documentById.get(id))}`,
    };
    met.set(id, made);
    return made;
  };
  return {
    refsOf: (ids) => [...new Set(ids)].map(refOf),
    cards: (holdsUpOf) =>
      [...met.values()].map((ref) => cardOf(ref, documentById.get(ref.id), holdsUpOf(ref.id))),
  };
}

/**
 * An endpoint is resolved one level only. Deeper, the sentence says `a relation`: a sentence
 * that unrolls a chain of relations is not readable on one line. */
function endpointWords(index: Index, kind: EndpointKind, id: string, depth: number): string {
  if (kind === 'entity') {
    return index.entityById.get(id)?.label ?? 'an entity that is absent from the record';
  }
  if (depth === 0) return 'a relation';
  const held = index.relationById.get(id);
  if (held === undefined) return 'a relation that is absent from the record';
  const from = endpointWords(index, held.srcKind, held.srcId, depth - 1);
  const to = endpointWords(index, held.dstKind, held.dstId, depth - 1);
  return `the "${index.wordsOf(held.type).label}" of ${from} and ${to}`;
}

/**
 * M6: an interval is written at both ends. A closed interval says that it is closed, or a
 * reader takes an ended relation for a current one. */
function intervalWords(relation: Relation): string | null {
  if (relation.validFrom !== null && relation.validTo !== null) {
    return `from ${relation.validFrom} to ${relation.validTo}, and closed`;
  }
  if (relation.validFrom !== null) return `from ${relation.validFrom}, with no end date`;
  if (relation.validTo !== null) return `to ${relation.validTo}, with no start date`;
  return null;
}

function typeChoicesOf(types: TypeVocabulary, held: string): readonly TypeChoice[] {
  const offered = types.filter((type) => !type.retired || type.key === held);
  const choices = offered.map((type) => ({ key: type.key, name: type.label }));
  const holds = choices.some((choice) => choice.key === held);
  return [...choices, ...(holds ? [] : [{ key: held, name: held }])].sort((one, other) =>
    one.name.localeCompare(other.name),
  );
}

export function readDossier(read: Corpus, entityId: string, types: TypeVocabulary): Dossier | null {
  const entity = read.entities.find((candidate) => candidate.id === entityId);
  if (entity === undefined) return null;

  const documentById = new Map(read.documents.map((row) => [row.id, row]));
  const index = indexOf(read);

  // Departure: the page order is the entity, then the claims, then the relations, then the
  // pending proposals, so the lists below call the register in that order.
  const { refsOf, cards } = sourceRegister(documentById);

  const entitySources = refsOf(entity.sources);

  const claims = readClaims(entity.attrs);
  const claimSources = claims.map((claim) => ({ claim, sources: refsOf(claim.sources) }));

  const rows: readonly RecordRow[] = claimSources.map((held) => ({
    claim: held.claim,
    sources: held.sources,
  }));

  const touches = (relation: Relation): boolean =>
    (relation.srcKind === 'entity' && relation.srcId === entityId) ||
    (relation.dstKind === 'entity' && relation.dstId === entityId);

  const direct = read.relations.filter(touches);
  const directIds = new Set(direct.map((relation) => relation.id));
  const pointing = read.relations.filter(
    (relation) =>
      !directIds.has(relation.id) &&
      ((relation.srcKind === 'relation' && directIds.has(relation.srcId)) ||
        (relation.dstKind === 'relation' && directIds.has(relation.dstId))),
  );

  // A relation is stored in one direction only. Read from its far end, it takes the inverse words,
  // so the entity of the page stands first in each sentence that names it.
  const sentenceOf = (relation: Relation): string => {
    const from = endpointWords(index, relation.srcKind, relation.srcId, 1);
    const to = endpointWords(index, relation.dstKind, relation.dstId, 1);
    const words = index.wordsOf(relation.type);
    const fromFarEnd =
      relation.dstKind === 'entity' &&
      relation.dstId === entityId &&
      !(relation.srcKind === 'entity' && relation.srcId === entityId);
    return fromFarEnd ? `${to} ${words.inverseLabel} ${from}` : `${from} ${words.label} ${to}`;
  };

  const relations: readonly RelationLine[] = [...direct, ...pointing].map((relation) => ({
    id: relation.id,
    sentence: sentenceOf(relation),
    interval: intervalWords(relation),
    // The mark comes from the relation and never from the list it is placed in: a relation can
    // be direct and invisible at once.
    undrawable: relation.srcKind === 'relation' || relation.dstKind === 'relation',
    sources: refsOf(relation.sources),
  }));

  // Departure: an act on a relation carries no ends, so the ends come from the relation it names,
  // and the act stands on the page of each end. A relation the record does not hold puts the act
  // on no page, which is the same answer the sentence of a missing endpoint gives.
  const namesATouchingRelation = (proposal: Proposal): boolean => {
    const target = proposal.targetKind === 'relation' ? proposal.targetId : null;
    const held = target === null ? undefined : index.relationById.get(target);
    return held !== undefined && touches(held);
  };

  // The act states the operation and the payload carries no kind of its own, so the operation
  // decides which keys stand inside it. Those keys keep the spelling the act wrote.
  const names = (proposal: Proposal): boolean => {
    if (proposal.targetKind === 'entity' && proposal.targetId === entityId) return true;
    const payload = proposal.payload;
    switch (proposal.op) {
      case 'create_relation':
        return (
          payload.kind === 'relation' &&
          (payload.src_id === entityId || payload.dst_id === entityId)
        );
      case 'update_attrs':
      case 'update_relation':
      case 'delete_relation':
        return namesATouchingRelation(proposal);
      case 'merge_entities':
        return (
          payload.kind === 'merge' &&
          (payload.keep_id === entityId || payload.merge_ids.includes(entityId))
        );
      case 'create_entity':
      case 'update_entity':
      case 'delete_entity':
        return false;
    }
  };

  const pending: readonly PendingLine[] = read.proposals
    .filter((proposal) => proposal.status === 'pending' && names(proposal))
    .map((proposal) => {
      // THIS LINE STATES NO VERDICT ON WHY THE ACT WAITS. The threshold that sends an act to
      // review is calibrated on real data, and no path carries one to the browser, so a figure
      // written here would settle an open question in code.
      const stated = proposal.confidence;
      const head = OP_WORDS[proposal.op];
      const keys = keysOf(proposal.payload);
      const body = keys.length === 0 ? head : `${head}: ${keys.join(', ')}`;
      return {
        id: proposal.id,
        summary: body,
        dissent: proposal.dissent,
        confidence: stated === null ? 'no confidence is stated' : stated.toFixed(2),
        origin: ORIGIN_WORDS[proposal.authorRole],
        sources: refsOf(proposal.src),
      };
    });

  const sources = cards((id) =>
    claims
      .filter((claim) => claim.sources.includes(id))
      .map((claim) => ({ key: claim.key, label: claim.label, text: claim.value.text })),
  );

  const linkChoices: LinkChoices = {
    types: [...new Set(read.relations.map((relation) => relation.type))].sort((one, other) =>
      one.localeCompare(other),
    ),
    targets: read.entities
      .filter((candidate) => candidate.id !== entityId)
      .map((candidate) => ({ id: candidate.id, name: `${candidate.label} — ${candidate.type}` }))
      .sort((one, other) => one.name.localeCompare(other.name)),
  };

  // Where the map draws this entity, and whose point it borrowed. T4 puts the walk in SQL, so
  // this file reads the answer and repeats no rule of it.
  const at = read.positions.find((row) => row.entityId === entity.id);
  const borrowed = at?.parentId ?? null;
  // Departure: the map and the entity list are two reads, so the parent can be absent from the
  // list. The point is still borrowed, so the words stand and only the name falls back.
  const positionFrom =
    borrowed === null
      ? null
      : positionFromWords(read.entities.find((row) => row.id === borrowed)?.label ?? 'a parent');

  return {
    entityId: entity.id,
    label: entity.label,
    type: entity.type,
    proposedType: entity.proposedType,
    drawnOnMap: (at?.point ?? null) !== null,
    positionFrom,
    rows,
    entitySources,
    sources,
    relations,
    pending,
    linkChoices,
    typeChoices: typeChoicesOf(types, entity.type),
  };
}

export interface RelationRow {
  /** The place of the line, and the key of the list. A relation on itself repeats the words. */
  readonly key: 'from' | 'type' | 'to';
  readonly text: string;
}

export interface RelationDossier {
  readonly relationId: string;
  readonly type: string;
  readonly rows: readonly RelationRow[];
  /** The heading arrow is a picture and not a word. This name gives the direction in the order
   * of the words, and never as "down arrow". */
  readonly sentence: string;
  /** M6, written at both ends. `null` where the relation carries no interval at all. */
  readonly interval: string | null;
  readonly sources: readonly SourceRef[];
  readonly cards: readonly SourceCardModel[];
}

/**
 * S2 at row level: the relation's list backs its type, its two ends and its dates, not one
 * attribute. M8 is attribute level only: every attribute cites at least one document. */
export function readRelation(read: Corpus, relationId: string): RelationDossier | null {
  const relation = read.relations.find((candidate) => candidate.id === relationId);
  if (relation === undefined) return null;

  const documentById = new Map(read.documents.map((row) => [row.id, row]));
  const index = indexOf(read);

  const from = endpointWords(index, relation.srcKind, relation.srcId, 1);
  const to = endpointWords(index, relation.dstKind, relation.dstId, 1);
  const type = index.wordsOf(relation.type).label;
  // `relationLines` lays out the words for this panel and for the two canvases at once.
  const [fromLine, typeLine, toLine] = relationLines(from, type, to);

  const register = sourceRegister(documentById);
  const sources = register.refsOf(relation.sources);
  // Departure: this view draws no claim, so no document holds one up here. The card says that
  // in its own words.
  const cards = register.cards(() => []);

  return {
    relationId: relation.id,
    type,
    rows: [
      { key: 'from', text: fromLine },
      { key: 'type', text: typeLine },
      { key: 'to', text: toLine },
    ],
    sentence: `${from} ${type} ${to}`,
    interval: intervalWords(relation),
    sources,
    cards,
  };
}
