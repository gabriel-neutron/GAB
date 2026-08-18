/**
 * The corpus, reduced to what one entity's detail surface draws.
 *
 * Built from `docs/detail-surface.md` §3.3, §3.5, §3.6, §4.3, §4.4, §4.6, §4.7, §5.1 and §5.5.
 * It is the one place that decides what "on this page" means, and every component of the
 * surface reads it.
 *
 * **It holds no state and it reads no module.** It takes the read as an argument, so the day
 * `src/contract/` exists the caller changes and this file does not. `spec.md` §4 puts the read
 * behind a view; until then the caller passes the fixture of #46.
 *
 * Three properties decide the shapes below, and each one keeps work out of a `.tsx`:
 *
 * - **A record row is flat.** A group heading is a row, so the record holds one `.map`.
 * - **Every line carries resolved sources**, and never a bare identifier. A `.find` in a
 *   component is how a claim loses its provenance (§5.1).
 * - **It carries arrays and no `Map`.** It is returned from a router loader.
 */

import type {
  Corpus,
  DocId,
  DocumentRow,
  EndpointKind,
  Proposal,
  Relation,
} from '@/shared/fixtures/types';

import { readClaims, type ClaimRow } from './claims';

/**
 * One cited document, at the position it was first met.
 *
 * §3.6: the badge on a claim is a number and not a score, because one score repeated on twenty
 * claims reads as a score for each claim. The score stays on the card in the rail, once. #12
 * owns whether a number satisfies the obligation of PU1, and this file does not answer it.
 */
export interface SourceRef {
  readonly id: DocId;
  /** 1-based, and the position in the page order of §4.4. */
  readonly number: number;
  /**
   * The accessible name of the mark: `Source 7 — <title>`.
   *
   * **The defect this shape exists to not repeat:** the name once ended `— B2, machine`, and
   * the mark carries that name on every claim. A document that holds up twenty claims then
   * announced `B2, machine` twenty times to a reader, which is the per-claim score §3.6 calls
   * false. The name says which document (M8) and no more. **The score stays on the card in the
   * rail, once.** Do not put a rating back in this string.
   */
  readonly name: string;
}

/** One claim that a document holds up, as the card behind the control lists it. */
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
  /**
   * Cited, and with no row in `documents`. **It is drawn and never hidden**: a surface that
   * drops evidence in silence is worse than one that says what it dropped.
   */
  readonly missing: boolean;
}

/**
 * One line of the record.
 *
 * **It was a union of two, and the heading half is gone** — #80. The names of the groups were
 * invented in `./claims`, and no data supplies them. `kind` stays, because a second kind of row is
 * what #85 DETAIL-SEGMENTATION may add.
 */
export interface RecordRow {
  readonly key: string;
  readonly kind: 'claim';
  readonly claim: ClaimRow;
  readonly sources: readonly SourceRef[];
}

export interface RelationLine {
  readonly id: string;
  /** Both endpoints, in words. */
  readonly sentence: string;
  /** M6: written at both ends, and a closed interval never reads as current. */
  readonly interval: string | null;
  /** §3.5: the mark of an M4 relation comes from the relation, never from the list. */
  readonly undrawable: boolean;
  readonly sources: readonly SourceRef[];
}

export interface PendingLine {
  readonly id: string;
  readonly summary: string;
  readonly dissent: boolean;
  /** Already formatted. A `.tsx` of this surface calls no `toFixed`. */
  readonly confidence: string;
  /** No dissent and high confidence: the gap of #42. The surface draws it and does not act. */
  readonly undecided: boolean;
  readonly sources: readonly SourceRef[];
}

export interface Dossier {
  readonly entityId: string;
  readonly label: string;
  readonly type: string;
  readonly rows: readonly RecordRow[];
  readonly entitySources: readonly SourceRef[];
  readonly sources: readonly SourceCardModel[];
  readonly relations: readonly RelationLine[];
  readonly pending: readonly PendingLine[];
  readonly claimCount: number;
}

/** #42: no dissent at or above this confidence is the row that neither S3 nor P1 decides. */
const HIGH_CONFIDENCE = 0.9;

/** A long address does not fit a two-line card (§3.3), so the card carries a short form too. */
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

/** An identifier of a type, in words: `berthed_at` reads as `berthed at`. */
const typeWords = (type: string): string => type.replaceAll('_', ' ');

function shorten(uri: string | null): string | null {
  if (uri === null) return null;
  const bare = uri.replace(/^https?:\/\//, '');
  return bare.length <= URI_LENGTH ? bare : `${bare.slice(0, URI_LENGTH - 1)}…`;
}

/**
 * Invariant 6: the rating and its origin are absent together. An absence must never read as a
 * low score, so an unrated document says `not rated` in words.
 *
 * One of the two absent alone breaks invariant 6. The words say that, because a surface that
 * guesses the missing half hides a fault in the data.
 */
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

export function readDossier(read: Corpus, entityId: string): Dossier | null {
  const entity = read.entities.find((candidate) => candidate.id === entityId);
  if (entity === undefined) return null;

  const documentById = new Map(read.documents.map((row) => [row.id, row]));
  const entityById = new Map(read.entities.map((row) => [row.id, row]));
  const relationById = new Map(read.relations.map((row) => [row.id, row]));

  // §4.4: each document is numbered in the order it is met — the entity, then the claims, then
  // the relations, then the pending proposals. This function is the register of that order, so
  // a document met twice keeps its first number and no caller can renumber it.
  const met = new Map<DocId, SourceRef>();
  const refOf = (id: DocId): SourceRef => {
    const held = met.get(id);
    if (held !== undefined) return held;
    const row = documentById.get(id);
    const number = met.size + 1;
    const title = row?.title ?? `Cited document ${id}, absent from the record`;
    // §3.6: the name names the document and never its score. See `SourceRef.name`.
    const made: SourceRef = { id, number, name: `Source ${number} — ${title}` };
    met.set(id, made);
    return made;
  };
  const refsOf = (ids: readonly DocId[]): readonly SourceRef[] => ids.map(refOf);

  const entitySources = refsOf(entity.sources);

  const claims = readClaims(entity.attrs);
  const claimSources = claims.map((claim) => ({ claim, sources: refsOf(claim.sources) }));

  // **The record is one flat list of claims.** The group headings are gone — #80 — because their
  // names were invented in `./claims` and no data supplies them. **#46** owns any real group, and
  // **#85 DETAIL-SEGMENTATION** owns how the four parts of this page are separated.
  const rows: readonly RecordRow[] = claimSources.map((held) => ({
    key: `claim:${held.claim.key}`,
    kind: 'claim',
    claim: held.claim,
    sources: held.sources,
  }));

  // §4.6: the relations with one endpoint on the entity, then the relations that point at
  // **those** relations, deduplicated against the first set.
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

  // An endpoint is resolved one level only. Deeper than that the sentence says `a relation`,
  // because a sentence that unrolls a chain of relations is not readable on one line.
  function endpointWords(kind: EndpointKind, id: string, depth: number): string {
    if (kind === 'entity') {
      return entityById.get(id)?.label ?? 'an entity that is absent from the record';
    }
    if (depth === 0) return 'a relation';
    const held = relationById.get(id);
    if (held === undefined) return 'a relation that is absent from the record';
    const from = endpointWords(held.srcKind, held.srcId, depth - 1);
    const to = endpointWords(held.dstKind, held.dstId, depth - 1);
    return `the "${typeWords(held.type)}" of ${from} and ${to}`;
  }

  // M6: an interval is written at both ends. A closed interval says that it is closed, because
  // a first version drew `2018-02-01 —` and a reader took a relation that ended for a current
  // one.
  function intervalWords(relation: Relation): string | null {
    if (relation.validFrom !== null && relation.validTo !== null) {
      return `from ${relation.validFrom} to ${relation.validTo}, and closed`;
    }
    if (relation.validFrom !== null) return `from ${relation.validFrom}, with no end date`;
    if (relation.validTo !== null) return `to ${relation.validTo}, with no start date`;
    return null;
  }

  const relations: readonly RelationLine[] = [...direct, ...pointing].map((relation) => ({
    id: relation.id,
    sentence: `${endpointWords(relation.srcKind, relation.srcId, 1)} ${typeWords(
      relation.type,
    )} ${endpointWords(relation.dstKind, relation.dstId, 1)}`,
    interval: intervalWords(relation),
    // §3.5: the mark comes from the relation. A first version marked it from the list it was
    // placed in, and the mark vanished on a relation that is direct and invisible at once.
    undrawable: relation.srcKind === 'relation' || relation.dstKind === 'relation',
    sources: refsOf(relation.sources),
  }));

  // §4.7: a pending proposal that names this entity, as a target or inside its payload.
  const names = (proposal: Proposal): boolean => {
    if (proposal.targetKind === 'entity' && proposal.targetId === entityId) return true;
    switch (proposal.payload.kind) {
      case 'relation':
        return proposal.payload.srcId === entityId || proposal.payload.dstId === entityId;
      case 'merge':
        return proposal.payload.keepId === entityId || proposal.payload.mergeIds.includes(entityId);
      case 'entity':
      case 'attrs':
      case 'delete':
        return false;
    }
  };

  const pending: readonly PendingLine[] = read.proposals
    .filter((proposal) => proposal.status === 'pending' && names(proposal))
    .map((proposal) => {
      const undecided = !proposal.dissent && proposal.confidence >= HIGH_CONFIDENCE;
      const head = OP_WORDS[proposal.op];
      // The humanised keys come from `readClaims`, so the guess of §3.2 stays in one file.
      const keys =
        proposal.payload.kind === 'attrs'
          ? readClaims(proposal.payload.attrs).map((claim) => claim.label)
          : [];
      const body = keys.length === 0 ? head : `${head}: ${keys.join(', ')}`;
      return {
        id: proposal.id,
        // #42 is named in the words, and the surface takes no action on the row.
        summary: undecided
          ? `${body}. No dissent, and the confidence is high: #42 must say what happens to this proposal.`
          : body,
        dissent: proposal.dissent,
        confidence: proposal.confidence.toFixed(2),
        undecided,
        sources: refsOf(proposal.src),
      };
    });

  // Every document that was met, in the order of §4.4. The claims a document holds up are read
  // from the rows above, so the card and the record can never disagree.
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

  return {
    entityId: entity.id,
    label: entity.label,
    type: entity.type,
    rows,
    entitySources,
    sources,
    relations,
    pending,
    claimCount: claims.length,
  };
}
