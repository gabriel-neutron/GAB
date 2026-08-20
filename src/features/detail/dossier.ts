/**
 * The corpus, reduced to what one entity's detail surface draws.
 *
 * It is the one place that decides what "on this page" means, and every component of the
 * surface reads it.
 *
 * **It holds no state and it reads no module.** It takes the read as an argument, so the day
 * `src/contract/` exists the caller changes and this file does not. The read sits behind a view;
 * until then the caller passes the fixture.
 *
 * Three properties decide the shapes below, and each one keeps work out of a `.tsx`:
 *
 * - **A record row is flat.** A group heading is a row, so the record holds one `.map`.
 * - **Every line carries resolved sources**, and never a bare identifier. A `.find` in a
 *   component is how a claim loses its provenance.
 * - **It carries arrays and no `Map`.** It is returned from a router loader.
 *
 * **Two reads, and they are one job.** `readDossier` reduces the corpus to one entity, and
 * `readRelation` reduces it to one relation. A canvas selects one of those two things, the panel
 * beside it draws whichever was selected, and both reads number a document by the register of
 * the page order and hand the same card to the same control. Two files would give one surface
 * two rules for
 * a source and two ways to name an endpoint.
 */

import { relationLines, relationTypeWords } from '@/shared/canvas-label';
import type {
  Corpus,
  DocId,
  DocumentRow,
  Entity,
  EndpointKind,
  Proposal,
  Relation,
} from '@/shared/fixtures/types';

import { readClaims, type ClaimRow } from './claims';

/**
 * One cited document, at the position it was first met.
 *
 * The badge on a claim is a number and not a score, because one score repeated on twenty claims
 * reads as a score for each claim. The score stays on the card in the rail, once. Whether a
 * number satisfies the obligation of PU1 is open, and this file does not answer it.
 */
export interface SourceRef {
  readonly id: DocId;
  /** 1-based, and the position in the page order. */
  readonly number: number;
  /**
   * The accessible name of the mark: `Source 7 — <title>`.
   *
   * **The defect this shape exists to not repeat:** the name once ended `— B2, machine`, and
   * the mark carries that name on every claim. A document that holds up twenty claims then
   * announced `B2, machine` twenty times to a reader, which is the per-claim score this surface
   * calls false. The name says which document (M8) and no more. **The score stays on the card
   * in the rail, once.** Do not put a rating back in this string.
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
 * **It was a union of two, and the heading half is gone.** The names of the groups were invented
 * in `./claims`, and no data supplies them. `kind` stays, because a second kind of row is what a
 * later segmentation of this page may add.
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
  /** The mark of an M4 relation comes from the relation, never from the list. */
  readonly undrawable: boolean;
  readonly sources: readonly SourceRef[];
}

export interface PendingLine {
  readonly id: string;
  readonly summary: string;
  readonly dissent: boolean;
  /** Already formatted. A `.tsx` of this surface calls no `toFixed`. */
  readonly confidence: string;
  /** No dissent and high confidence: the gap the tracker holds. The surface draws it and does
   * not act. */
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

/**
 * An identifier of a type, in words: `berthed_at` reads as `berthed at`.
 *
 * **The rule left this file.** The operator ruled that one relation carries one name on every
 * surface. `shared/canvas-label.ts` holds it, and both canvases read the same function.
 */
const typeWords = relationTypeWords;

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

/**
 * The two indexes an endpoint is resolved against. **Both readers of this file build one**, so
 * the words that name an endpoint are written in one place and the two views can never disagree
 * about what sits at the end of a relation.
 */
interface Index {
  readonly entityById: ReadonlyMap<string, Entity>;
  readonly relationById: ReadonlyMap<string, Relation>;
}

/**
 * An endpoint is resolved one level only. Deeper than that the sentence says `a relation`,
 * because a sentence that unrolls a chain of relations is not readable on one line.
 */
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
 * M6: an interval is written at both ends. A closed interval says that it is closed, because a
 * first version drew `2018-02-01 —` and a reader took a relation that ended for a current one.
 */
function intervalWords(relation: Relation): string | null {
  if (relation.validFrom !== null && relation.validTo !== null) {
    return `from ${relation.validFrom} to ${relation.validTo}, and closed`;
  }
  if (relation.validFrom !== null) return `from ${relation.validFrom}, with no end date`;
  if (relation.validTo !== null) return `to ${relation.validTo}, with no start date`;
  return null;
}

export function readDossier(read: Corpus, entityId: string): Dossier | null {
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
    // The name names the document and never its score. See `SourceRef.name`.
    const made: SourceRef = { id, number, name: `Source ${number} — ${title}` };
    met.set(id, made);
    return made;
  };
  const refsOf = (ids: readonly DocId[]): readonly SourceRef[] => ids.map(refOf);

  const entitySources = refsOf(entity.sources);

  const claims = readClaims(entity.attrs);
  const claimSources = claims.map((claim) => ({ claim, sources: refsOf(claim.sources) }));

  // **The record is one flat list of claims.** The group headings are gone, because their names
  // were invented in `./claims` and no data supplies them. A real group needs an attribute that
  // carries one, and how the four parts of this page are separated is open. The tracker carries
  // both.
  const rows: readonly RecordRow[] = claimSources.map((held) => ({
    key: `claim:${held.claim.key}`,
    kind: 'claim',
    claim: held.claim,
    sources: held.sources,
  }));

  // The relations with one endpoint on the entity, then the relations that point at
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

  const relations: readonly RelationLine[] = [...direct, ...pointing].map((relation) => ({
    id: relation.id,
    sentence: `${endpointWords(index, relation.srcKind, relation.srcId, 1)} ${typeWords(
      relation.type,
    )} ${endpointWords(index, relation.dstKind, relation.dstId, 1)}`,
    interval: intervalWords(relation),
    // The mark comes from the relation. A first version marked it from the list it was
    // placed in, and the mark vanished on a relation that is direct and invisible at once.
    undrawable: relation.srcKind === 'relation' || relation.dstKind === 'relation',
    sources: refsOf(relation.sources),
  }));

  // A pending proposal that names this entity, as a target or inside its payload.
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
      // The humanised keys come from `readClaims`, so the guess stays in one file.
      const keys =
        proposal.payload.kind === 'attrs'
          ? readClaims(proposal.payload.attrs).map((claim) => claim.label)
          : [];
      const body = keys.length === 0 ? head : `${head}: ${keys.join(', ')}`;
      return {
        id: proposal.id,
        // The state is named in the words, and the surface takes no action on the row. **An
        // analyst is not a reader of the tracker**, so the sentence says what the record holds
        // and never which ticket owes an answer.
        summary: undecided
          ? `${body}. No dissent, and the confidence is high: what happens to this proposal is not yet decided.`
          : body,
        dissent: proposal.dissent,
        confidence: proposal.confidence.toFixed(2),
        undecided,
        sources: refsOf(proposal.src),
      };
    });

  // Every document that was met, in the order above. The claims a document holds up are read
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

/**
 * One line of the heading of a relation view. The three of them are the three lines that both
 * canvases already draw over a relation.
 */
export interface RelationRow {
  /** The place of the line, and the key of the list. A relation on itself repeats the words. */
  readonly key: 'from' | 'type' | 'to';
  readonly text: string;
}

/**
 * One relation, as the panel beside a canvas draws it.
 *
 * **It is simpler than a dossier, and the operator asked for that**: the entity at each end, the
 * type, and the sources. It carries no record of claims, no list of relations and no proposal.
 */
export interface RelationDossier {
  readonly relationId: string;
  /** The type in words, as every other line of this surface writes an identifier. */
  readonly type: string;
  /** The heading, in the words of `shared/canvas-label.ts`. The arrow is the direction. */
  readonly rows: readonly RelationRow[];
  /**
   * The same relation on one line, for the accessible name of the panel. **The arrow of the
   * heading is a picture and not a word**: a reader who is given the name of the panel hears the
   * direction in the order of the words, and never as "down arrow".
   */
  readonly sentence: string;
  /** M6, written at both ends. `null` where the relation carries no interval at all. */
  readonly interval: string | null;
  readonly sources: readonly SourceRef[];
  readonly cards: readonly SourceCardModel[];
}

/**
 * The corpus, reduced to what the detail view of one relation draws.
 *
 * **The direction is not written here.** `shared/canvas-label.ts` states a relation in three
 * lines with an arrow, both canvases draw those words over a line, and this function takes the
 * same three. A second wording for one direction is how two surfaces come to disagree about
 * which way a relation points.
 *
 * **The sources are presented as the entity view presents them** — the same register, one
 * `SourceRef` for each document, and the same card. **What "the sources of a relation" means is
 * open, and the tracker carries it.**
 *
 * **The entry that gives a relation its own list is S2, and not M8.** M8 is attribute level only:
 * every attribute cites at least one document. S2 is the entry that says "the entity and the
 * relation carry a list of sources; each attribute additionally carries its own `src`", and
 * invariant 2 cites S2 for `relations.sources`. The tracker names M8 instead, and an entry of the
 * register changes only when a new decision names it, so a decision that names M8 alone would
 * leave this contradiction standing. **That correction is reported, and it is the operator's.**
 *
 * This function answers nothing. It lists `relation.sources`, which is the column the read
 * carries, and the tension is reported.
 */
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
  // The raw identifier goes in. `relationLines` states the words, for this panel and for the two
  // canvases at once, so no caller humanises a type before it calls.
  const [fromLine, typeLine, toLine] = relationLines(from, relation.type, to);

  // A document is numbered at the position where it is first met. A relation cites its own
  // documents and nothing else, so this register holds one list. **A document cited twice keeps
  // one number and one card**: two entries of one document would draw one key twice in the list
  // of the panel, and would count the evidence twice.
  const met = new Map<DocId, SourceRef>();
  for (const id of relation.sources) {
    if (met.has(id)) continue;
    const number = met.size + 1;
    const title = documentById.get(id)?.title ?? `Cited document ${id}, absent from the record`;
    // The name names the document and never its score. See `SourceRef.name`.
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
      // **This view draws no claim, so no document holds one up here.** The card says that in
      // its own words. It invents no claim from the attributes of the relation: the operator
      // asked for the two ends, the type and the sources, and the tracker carries what is left
      // out.
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
