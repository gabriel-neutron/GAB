/** A router loader returns these shapes, so they carry arrays and no `Map`. */

import { relationLines, relationTypeWords } from '@/shared/canvas-label';
import type {
  Corpus,
  DocId,
  Vocabulary,
  DocumentRow,
  Entity,
  EndpointKind,
  Proposal,
  Relation,
} from '@/shared/read/model';

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
  readonly uri: string | null;
  readonly uriShort: string | null;
  readonly retrievedAt: string | null;
  readonly holdsUp: readonly ClaimLine[];
  /** Cited, and with no row in `documents`. It is drawn and never hidden: a surface that drops
   * evidence in silence is worse than one that says what it dropped. */
  readonly missing: boolean;
}

/** `kind` is a one-member union: a second kind of row is what a later split of this
 * page adds. */
export interface RecordRow {
  readonly key: string;
  readonly kind: 'claim';
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
  readonly undecided: boolean;
  readonly sources: readonly SourceRef[];
}

/** One entity the analyst may put at the other end of a new relation. `name` is the word on the
 * option, and it is composed here so that no component joins a label to a type. */
export interface LinkTarget {
  readonly id: string;
  readonly name: string;
}

/** What the new-relation form offers. The record holds no table of relation types, so `types` is
 * what the corpus already carries and never a closed set. */
export interface LinkChoices {
  readonly types: readonly string[];
  readonly targets: readonly LinkTarget[];
}

export interface Dossier {
  readonly entityId: string;
  readonly label: string;
  readonly type: string;
  /** The word the extraction wrote, kept when it was not a live type. The row stands as
   * `unknown`, and the word must reach the screen or the entry is lost to the reader. */
  readonly proposedType: string | null;
  /** The map draws a point and nothing else, so an entity that carries no geometry is absent
   * from it. A link to the map for one of those opens a surface that selects nothing. */
  readonly drawnOnMap: boolean;
  readonly rows: readonly RecordRow[];
  readonly entitySources: readonly SourceRef[];
  readonly sources: readonly SourceCardModel[];
  readonly relations: readonly RelationLine[];
  readonly pending: readonly PendingLine[];
  readonly claimCount: number;
  readonly linkChoices: LinkChoices;
}

/** No dissent at or above this confidence is the row that neither S3 nor P1 decides. */
const HIGH_CONFIDENCE = 0.9;

/** A long address does not fit a two-line card, so the card carries a short form too. */
const URI_LENGTH = 44;

const OP_WORDS: Readonly<Record<Proposal['op'], string>> = {
  create_entity: 'Creates an entity',
  update_attrs: 'Changes an attribute',
  delete_entity: 'Deletes an entity',
  create_relation: 'Creates a relation',
  update_relation: 'Changes a relation',
  delete_relation: 'Deletes a relation',
  merge_entities: 'Merges entities',
};

const typeWords = relationTypeWords;

function shorten(uri: string | null): string | null {
  if (uri === null) return null;
  const bare = uri.replace(/^https?:\/\//, '');
  return bare.length <= URI_LENGTH ? bare : `${bare.slice(0, URI_LENGTH - 1)}…`;
}

/**
 * Invariant 6: the rating and its origin are absent together. An unrated document says
 * `not rated` in words, because an absence must never read as a low score. */
function readRating(row: DocumentRow | undefined): {
  rated: boolean;
  score: string;
  scoreOrigin: string;
} {
  if (row === undefined) return { rated: false, score: 'not rated', scoreOrigin: '' };
  if (row.admiralty !== null && row.admiraltyOrigin !== null) {
    return { rated: true, score: row.admiralty, scoreOrigin: row.admiraltyOrigin };
  }
  if (row.admiralty === null && row.admiraltyOrigin === null) {
    return { rated: false, score: 'not rated', scoreOrigin: '' };
  }
  return {
    rated: false,
    score: 'rating incomplete',
    scoreOrigin: 'invariant 6: a rating and its origin are absent together',
  };
}

interface Index {
  readonly entityById: ReadonlyMap<string, Entity>;
  readonly relationById: ReadonlyMap<string, Relation>;
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
  return `the "${typeWords(held.type)}" of ${from} and ${to}`;
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

export function readDossier(
  read: Corpus,
  entityId: string,
  vocabulary: Vocabulary,
): Dossier | null {
  const entity = read.entities.find((candidate) => candidate.id === entityId);
  if (entity === undefined) return null;

  const documentById = new Map(read.documents.map((row) => [row.id, row]));
  const index: Index = {
    entityById: new Map(read.entities.map((row) => [row.id, row])),
    relationById: new Map(read.relations.map((row) => [row.id, row])),
  };

  // Each document is numbered in the order it is met — the entity, then the claims, then
  // the relations, then the pending proposals. This function is the register of that order, so
  // a document met twice keeps its first number and no caller can renumber it.
  const met = new Map<DocId, SourceRef>();
  const refOf = (id: DocId): SourceRef => {
    const held = met.get(id);
    if (held !== undefined) return held;
    const row = documentById.get(id);
    const number = met.size + 1;
    const title = row?.title ?? `Cited document ${id}, absent from the record`;
    // The name names the document and never its score.
    const made: SourceRef = { id, number, name: `Source ${number} — ${title}` };
    met.set(id, made);
    return made;
  };
  const refsOf = (ids: readonly DocId[]): readonly SourceRef[] => ids.map(refOf);

  const entitySources = refsOf(entity.sources);

  const claims = readClaims(entity.attrs, vocabulary);
  const claimSources = claims.map((claim) => ({ claim, sources: refsOf(claim.sources) }));

  const rows: readonly RecordRow[] = claimSources.map((held) => ({
    key: `claim:${held.claim.key}`,
    kind: 'claim',
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

  const relations: readonly RelationLine[] = [...direct, ...pointing].map((relation) => ({
    id: relation.id,
    sentence: `${endpointWords(index, relation.srcKind, relation.srcId, 1)} ${typeWords(
      relation.type,
    )} ${endpointWords(index, relation.dstKind, relation.dstId, 1)}`,
    interval: intervalWords(relation),
    // The mark comes from the relation and never from the list it is placed in: a relation can
    // be direct and invisible at once.
    undrawable: relation.srcKind === 'relation' || relation.dstKind === 'relation',
    sources: refsOf(relation.sources),
  }));

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
      case 'update_relation': {
        // This act carries attributes and no ends, so the ends come from the relation it names.
        // A relation the record does not hold puts the act on no page, which is the same answer
        // the sentence of a missing endpoint gives.
        const target = proposal.targetKind === 'relation' ? proposal.targetId : null;
        const held = target === null ? undefined : index.relationById.get(target);
        return held !== undefined && touches(held);
      }
      case 'merge_entities':
        return (
          payload.kind === 'merge' &&
          (payload.keep_id === entityId || payload.merge_ids.includes(entityId))
        );
      case 'create_entity':
      case 'update_attrs':
      case 'delete_entity':
      case 'delete_relation':
        return false;
    }
  };

  const pending: readonly PendingLine[] = read.proposals
    .filter((proposal) => proposal.status === 'pending' && names(proposal))
    .map((proposal) => {
      // An act may state no confidence. That is an absence and never a high score, so it is
      // not the undecided row.
      const stated = proposal.confidence;
      const undecided = !proposal.dissent && stated !== null && stated >= HIGH_CONFIDENCE;
      const head = OP_WORDS[proposal.op];
      const keys =
        proposal.payload.kind === 'attrs'
          ? readClaims(proposal.payload.attrs, vocabulary).map((claim) => claim.label)
          : [];
      const body = keys.length === 0 ? head : `${head}: ${keys.join(', ')}`;
      return {
        id: proposal.id,
        summary: undecided
          ? `${body}. No dissent, and the confidence is high: what happens to this proposal is not yet decided.`
          : body,
        dissent: proposal.dissent,
        confidence: stated === null ? 'no confidence is stated' : stated.toFixed(2),
        undecided,
        sources: refsOf(proposal.src),
      };
    });

  const sources: readonly SourceCardModel[] = [...met.values()].map((ref) => {
    const row = documentById.get(ref.id);
    const rating = readRating(row);
    return {
      id: ref.id,
      number: ref.number,
      title: row?.title ?? `Cited document ${ref.id}, absent from the record`,
      rated: rating.rated,
      score: rating.score,
      scoreOrigin: rating.scoreOrigin,
      uri: row?.uri ?? null,
      uriShort: shorten(row?.uri ?? null),
      retrievedAt: row?.retrievedAt ?? null,
      holdsUp: claimSources
        .filter((held) => held.claim.sources.includes(ref.id))
        .map((held) => ({
          key: held.claim.key,
          label: held.claim.label,
          text: held.claim.value.text,
        })),
      missing: row === undefined,
    };
  });

  const linkChoices: LinkChoices = {
    types: [...new Set(read.relations.map((relation) => relation.type))].sort((one, other) =>
      one.localeCompare(other),
    ),
    targets: read.entities
      .filter((candidate) => candidate.id !== entityId)
      .map((candidate) => ({ id: candidate.id, name: `${candidate.label} — ${candidate.type}` }))
      .sort((one, other) => one.name.localeCompare(other.name)),
  };

  return {
    entityId: entity.id,
    label: entity.label,
    type: entity.type,
    proposedType: entity.proposedType,
    drawnOnMap: entity.geom !== null,
    rows,
    entitySources,
    sources,
    relations,
    pending,
    claimCount: claims.length,
    linkChoices,
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
 * The list of sources of a relation comes from S2: the entity and the relation each carry a
 * list. M8 is attribute level only: every attribute cites at least one document. */
export function readRelation(read: Corpus, relationId: string): RelationDossier | null {
  const relation = read.relations.find((candidate) => candidate.id === relationId);
  if (relation === undefined) return null;

  const documentById = new Map(read.documents.map((row) => [row.id, row]));
  const index: Index = {
    entityById: new Map(read.entities.map((row) => [row.id, row])),
    relationById: new Map(read.relations.map((row) => [row.id, row])),
  };

  const from = endpointWords(index, relation.srcKind, relation.srcId, 1);
  const to = endpointWords(index, relation.dstKind, relation.dstId, 1);
  const type = typeWords(relation.type);
  // The raw identifier goes in. `relationLines` states the words for this panel and for the two
  // canvases at once.
  const [fromLine, typeLine, toLine] = relationLines(from, relation.type, to);

  // A document is numbered at the position where it is first met. A document cited twice keeps
  // one number and one card: two entries would draw one key twice, and would count the evidence
  // twice.
  const met = new Map<DocId, SourceRef>();
  for (const id of relation.sources) {
    if (met.has(id)) continue;
    const number = met.size + 1;
    const title = documentById.get(id)?.title ?? `Cited document ${id}, absent from the record`;
    // The name names the document and never its score.
    met.set(id, { id, number, name: `Source ${number} — ${title}` });
  }
  const sources = [...met.values()];

  const cards: readonly SourceCardModel[] = sources.map((ref) => {
    const row = documentById.get(ref.id);
    const rating = readRating(row);
    return {
      id: ref.id,
      number: ref.number,
      title: row?.title ?? `Cited document ${ref.id}, absent from the record`,
      rated: rating.rated,
      score: rating.score,
      scoreOrigin: rating.scoreOrigin,
      uri: row?.uri ?? null,
      uriShort: shorten(row?.uri ?? null),
      retrievedAt: row?.retrievedAt ?? null,
      // This view draws no claim, so no document holds one up here. The card says that in its
      // own words.
      holdsUp: [],
      missing: row === undefined,
    };
  });

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
