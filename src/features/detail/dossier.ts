/** A router loader returns these shapes, so they carry arrays and no `Map`. */

import { relationDefinition } from '@gab/proposal/relation-types';
import { SHARE_IMPUTED_KEY, SHARE_KEY, shareWords } from '@gab/proposal/share';
import { relationLines } from '@/shared/canvas-label';
import { proposerWords } from '@/shared/proposer-words';
import { idOf, isUnread, type DecidedLine } from '@/shared/read/decided-acts';
import type {
  AttributeValue,
  Corpus,
  DocId,
  DocumentRow,
  Entity,
  EndpointKind,
  Proposal,
  Relation,
  TypeVocabulary,
} from '@/shared/read/model';
import { relationWording, type RelationWords } from '@/shared/relation-words';
import { keyWords } from '@/shared/key-words';
import { typeLabel } from '@/shared/type-label';

import { readClaims, type ClaimRow } from './claims';
import type { ReleaseFacts } from './release-facts';
import { vesselIdentity, type VesselIdentity } from './vessel-identity';

/** One cited document, at the position it was first met. The badge is a number. */
export interface SourceRef {
  readonly id: DocId;
  /** 1-based, and the position in the page order. */
  readonly number: number;
  /** The fact that the mark documents, in words. */
  readonly fact: string;
  /** The accessible name of the mark: `Source 7 for: <fact>`. It says which fact the button
   * documents, so no two buttons of one panel read the same. */
  readonly name: string;
}

/** A relation that a document backs, as the reader meets it on the page. */
export interface BackedFact {
  readonly key: string;
  readonly text: string;
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
  readonly uri: string | null;
  readonly uriShort: string | null;
  readonly retrievedAt: string | null;
  /** The kind in words. It is null where the record holds no row for the document. */
  readonly kind: string | null;
  /** The stored import of the old data set: it has no web address and it is no primary source. */
  readonly imported: boolean;
  /** The relations that the document backs: the type, the ends and the dates. */
  readonly backs: readonly BackedFact[];
  /** The attributes of the entity that the document backs. */
  readonly holdsUp: readonly ClaimLine[];
  /** Cited, and with no row in `documents`. It is drawn and never hidden: a surface that drops
   * evidence in silence is worse than one that says what it dropped. */
  readonly missing: boolean;
  /** The record holds the bytes of the document, so the worker can extract its claims. */
  readonly extractable: boolean;
}

export interface RecordRow {
  readonly claim: ClaimRow;
  readonly sources: readonly SourceRef[];
}

export interface RelationLine {
  readonly id: string;
  readonly sentence: string;
  /** What the type of the relation means, or `null` for a type with no definition. */
  readonly definition: string | null;
  /** The type in the words of the sentence. It is set only where another relation links the same
   * two ends, so a reader can tell the two lines apart. */
  readonly typeShown: string | null;
  /** M6: written at both ends, and a closed interval never reads as current. */
  readonly interval: string | null;
  /** The mark of an M4 relation comes from the relation, never from the list. */
  readonly undrawable: boolean;
  /** The share of an ownership link in words, with the mark of a share that GEM estimated.
   * `null` where the relation holds no share. */
  readonly share: string | null;
  /** Each other stored attribute of the relation, as "Key: value". Empty where there is none. */
  readonly facts: readonly string[];
  readonly sources: readonly SourceRef[];
}

export interface PendingLine {
  readonly id: string;
  readonly summary: string;
  readonly dissent: boolean;
  /** Who proposed the act, in the words of the review. */
  readonly origin: string;
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
  /** The label of the type, from the vocabulary. */
  readonly typeName: string;
  /** The word the extraction wrote, kept when it was not a live type. The row stands as
   * `unknown`, and the word must reach the screen or the entry is lost to the reader. */
  readonly proposedType: string | null;
  /** The resolved position decides this, and never `Entity.geom`: an entity that inherits its
   * point carries no geometry of its own AND the map draws it. A link to the map for an entity
   * the map draws nowhere opens a surface that selects nothing. */
  readonly drawnOnMap: boolean;
  /** Departure: "Position borrowed from <parent label> (no own position recorded)", with "a
   * parent" when the list lacks the parent, or null at its own point. The panel draws no canvas,
   * so these words are the only place it can state a borrowed position. */
  readonly positionFrom: string | null;
  /** The parents between the unit and the parent that gave the point, nearest first. It ends
   * with that parent, and it is empty at an own point. */
  readonly positionChain: readonly string[];
  /** The affiliation as the record states it: the point of view of the project, not a finding.
   * Null where the record states none. */
  readonly affiliation: string | null;
  /** The newest day on which a source of the claims of this entity was read, or null. */
  readonly sourceDay: string | null;
  /** The flag, the MMSI and the call sign, or null for an entity that is no vessel. */
  readonly identity: VesselIdentity | null;
  /** Who promoted the entity into the record, how and on which day. Null when the read of
   * the decided acts does not hold its promotion. */
  readonly decision: string | null;
  readonly rows: readonly RecordRow[];
  readonly entitySources: readonly SourceRef[];
  readonly sources: readonly SourceCardModel[];
  readonly relations: readonly RelationLine[];
  readonly pending: readonly PendingLine[];
  readonly linkChoices: LinkChoices;
  /** A retired type the entity holds stays offered, or the chooser would draw a type the entity
   * does not hold. */
  readonly typeChoices: readonly TypeChoice[];
  /** What the release adds. The record has none of it, so `readDossier` leaves it null and the
   * route fills it when a release is at hand. */
  readonly facts: ReleaseFacts | null;
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
  undo_merge: 'Undoes a merge',
  map_document: 'Maps the columns of a table',
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
  readonly documentById: ReadonlyMap<DocId, DocumentRow>;
  readonly wordsOf: (type: string) => RelationWords;
  readonly takesPeriod: (type: string) => boolean;
}

function indexOf(read: Corpus): Index {
  return {
    entityById: new Map(read.entities.map((row) => [row.id, row])),
    relationById: new Map(read.relations.map((row) => [row.id, row])),
    documentById: new Map(read.documents.map((row) => [row.id, row])),
    wordsOf: relationWording(read.relationTypes),
    takesPeriod: (type) => read.relationTypes.some((one) => one.key === type && one.takesInterval),
  };
}

function cardOf(
  id: DocId,
  number: number,
  row: DocumentRow | undefined,
  backs: readonly BackedFact[],
  holdsUp: readonly ClaimLine[],
): SourceCardModel {
  return {
    id,
    number,
    title: titleOf(id, row),
    uri: row?.uri ?? null,
    uriShort: shorten(row?.uri ?? null),
    retrievedAt: row?.retrievedAt ?? null,
    kind: kindOf(row),
    imported: isImport(row),
    backs,
    holdsUp,
    missing: row === undefined,
    extractable: row?.sha256 !== undefined && row.sha256 !== null,
  };
}

const KIND_WORDS: Readonly<Record<DocumentRow['kind'], string>> = {
  url: 'Web page',
  file: 'File',
  api: 'API',
  report: 'Report',
  manual: 'Manual entry',
};

// External constraint: the stored import has kind `file`, and the writer names it by this title
// alone. The title is the key that the batch door uses to reserve the import.
const IMPORT_TITLE = 'GAB v1 ORBAT: military units and organisations of the v1 GeoPackage';

const isImport = (row: DocumentRow | undefined): boolean => row?.title === IMPORT_TITLE;

function kindOf(row: DocumentRow | undefined): string | null {
  if (row === undefined) return null;
  return isImport(row) ? 'Import' : KIND_WORDS[row.kind];
}

function titleOf(id: DocId, row: DocumentRow | undefined): string {
  return row?.title ?? `Cited document ${id}, absent from the record`;
}

interface SourceRegister {
  /** `listed` is false for an attribute: the card lists attributes in their own group. */
  readonly refsOf: (ids: readonly DocId[], fact: string, listed?: boolean) => readonly SourceRef[];
  readonly cards: (holdsUpOf: (id: DocId) => readonly ClaimLine[]) => readonly SourceCardModel[];
}

// Departure: a document keeps the number of the list where it is first met, so the call order
// of `refsOf` is the page order. A document cited twice is one mark and one card: two entries
// would draw one key twice, and would count the evidence twice.
function sourceRegister(documentById: ReadonlyMap<DocId, DocumentRow>): SourceRegister {
  const met = new Map<DocId, number>();
  const backed = new Map<DocId, BackedFact[]>();
  const facts = new Set<string>();
  const numberOf = (id: DocId): number => {
    const held = met.get(id);
    if (held !== undefined) return held;
    const number = met.size + 1;
    met.set(id, number);
    return number;
  };
  // Two facts can read the same, so a repeat takes an ordinal and each name stays unique.
  const uniqueFact = (fact: string): string => {
    let candidate = fact;
    for (let ordinal = 2; facts.has(candidate); ordinal += 1) candidate = `${fact} (${ordinal})`;
    facts.add(candidate);
    return candidate;
  };
  return {
    refsOf: (ids, text, listed = true) => {
      const fact = uniqueFact(text);
      return [...new Set(ids)].map((id) => {
        const number = numberOf(id);
        if (listed) backed.set(id, [...(backed.get(id) ?? []), { key: fact, text: fact }]);
        return { id, number, fact, name: `Source ${number} for: ${fact}` };
      });
    },
    cards: (holdsUpOf) =>
      [...met].map(([id, number]) =>
        cardOf(id, number, documentById.get(id), backed.get(id) ?? [], holdsUpOf(id)),
      ),
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

const DESIGNATION = 'designated_by';

const nameOf = (read: Corpus, id: string): string =>
  read.entities.find((row) => row.id === id)?.label ?? 'a parent';

// Departure: the SQL walk gives the parent that supplied the point and not the path to it, so the
// path is found here. It is the shortest path, as the SQL picks the nearest parent, and it stops at
// the hop limit of the SQL walk. A unit can have more than one parent, and bad source data can hold
// a ring, so each unit is met once. With no path the chain holds the parent alone.
const MAX_HOPS = 4;

function parentChain(read: Corpus, entityId: string, source: string): readonly string[] {
  const from = new Map<string, string>();
  let level = [entityId];
  const met = new Set(level);
  for (let hop = 0; hop < MAX_HOPS && !met.has(source); hop += 1) {
    const next: string[] = [];
    for (const at of level)
      for (const one of read.relations) {
        if (
          one.type !== 'subordinate_to' ||
          one.srcKind !== 'entity' ||
          one.dstKind !== 'entity' ||
          one.srcId !== at ||
          met.has(one.dstId)
        )
          continue;
        met.add(one.dstId);
        from.set(one.dstId, at);
        next.push(one.dstId);
      }
    level = next;
  }
  if (!met.has(source)) return [nameOf(read, source)];
  const chain: string[] = [];
  for (let at = source; at !== entityId; at = from.get(at) ?? entityId)
    chain.unshift(nameOf(read, at));
  return chain;
}

function newestDay(documents: readonly DocumentRow[]): string | null {
  const days = documents
    .map((one) => one.retrievedAt?.slice(0, 10))
    .filter((day): day is string => day !== undefined && day !== '');
  return days.reduce<string | null>(
    (newest, day) => (newest === null || day > newest ? day : newest),
    null,
  );
}

// An absent end is not a live status: the record says only that no end is recorded.
function periodWords(relation: Relation): string | null {
  if (relation.validFrom !== null && relation.validTo !== null) {
    return `from ${relation.validFrom} to ${relation.validTo}, and closed`;
  }
  if (relation.validFrom !== null) return `from ${relation.validFrom}, no end date recorded`;
  if (relation.validTo !== null) return `to ${relation.validTo}, with no start date`;
  return null;
}

// The newest retrieval date of the sources of the relation, or null where no source has one.
function checkDayOf(index: Index, relation: Relation): string | null {
  return newestDay(
    relation.sources.flatMap((id) => {
      const document = index.documentById.get(id);
      return document === undefined ? [] : [document];
    }),
  );
}

function designationWords(index: Index, relation: Relation): string {
  const issuer =
    relation.dstKind === 'entity' ? index.entityById.get(relation.dstId)?.label : undefined;
  const acts = relation.sources
    .map((id) => index.documentById.get(id))
    .filter((row): row is DocumentRow => row?.docType === 'legal_act')
    .map((row) => row.title);
  const listed = [
    `listed by ${issuer ?? 'an issuer that is absent from the record'}`,
    relation.validFrom === null ? '' : ` on ${relation.validFrom}`,
    acts.length === 0 ? '' : ` under ${acts.join(', ')}`,
  ].join('');
  const end =
    relation.validTo === null
      ? 'no end date recorded'
      : `ended on ${relation.validTo}, and closed${relation.validFrom === null ? ', with no start date' : ''}`;
  const checked = checkDayOf(index, relation);
  return `${listed}, ${end}${checked === null ? '' : `; status checked on ${checked}`}`;
}

/**
 * M6: an interval is written at both ends. A closed interval says that it is closed, or a
 * reader takes an ended relation for a current one. An open interval says that no end is
 * recorded, and never that the relation holds now. */
function intervalWords(index: Index, relation: Relation): string | null {
  return relation.type === DESIGNATION ? designationWords(index, relation) : periodWords(relation);
}

/** What a line writes for the period. A type that takes a period and holds none says so, because
 * a blank reads as a period that does not apply. */
function periodLine(index: Index, relation: Relation): string | null {
  return (
    intervalWords(index, relation) ??
    (index.takesPeriod(relation.type) ? 'period not recorded' : null)
  );
}

function factWord(value: AttributeValue): string {
  return typeof value === 'object' ? value.join(', ') : String(value);
}

/** Every stored attribute of a relation that the share does not already word. */
function storedFacts(relation: Relation): readonly string[] {
  return (
    Object.entries(relation.attrs)
      // The share words these two keys. A share it cannot word, such as a text value, stays a fact.
      .filter(([key]) =>
        shareWords(relation.attrs) === null
          ? key !== SHARE_IMPUTED_KEY
          : key !== SHARE_KEY && key !== SHARE_IMPUTED_KEY,
      )
      .sort(([one], [other]) => one.localeCompare(other))
      .map(([key, attribute]) => `${keyWords(key).label}: ${factWord(attribute.v)}`)
  );
}

/** The relation as a fact, with its dates, so a reader sees what the document backs. */
function factWords(sentence: string, interval: string | null): string {
  return interval === null ? sentence : `${sentence}, ${interval}`;
}

function typeChoicesOf(types: TypeVocabulary, held: string): readonly TypeChoice[] {
  const offered = types.filter((type) => !type.retired || type.key === held);
  const choices = offered.map((type) => ({ key: type.key, name: type.label }));
  const holds = choices.some((choice) => choice.key === held);
  return [...choices, ...(holds ? [] : [{ key: held, name: typeLabel(held) }])].sort((one, other) =>
    one.name.localeCompare(other.name),
  );
}

// PU1: the origin line is the label that the public data carries, word for word. The record
// writes the words and the day, so the screen and a copy of the data cannot say two things.
function decisionOf(entityFrom: string, decided: readonly DecidedLine[]): string | null {
  const held = decided.find((line) => idOf(line) === entityFrom);
  if (held === undefined) return null;
  return isUnread(held) ? 'The act that promoted this entity cannot be read.' : held.originLabel;
}

export function readDossier(
  read: Corpus,
  entityId: string,
  types: TypeVocabulary,
  decided: readonly DecidedLine[],
): Dossier | null {
  const entity = read.entities.find((candidate) => candidate.id === entityId);
  if (entity === undefined) return null;

  const documentById = new Map(read.documents.map((row) => [row.id, row]));
  const index = indexOf(read);

  // Departure: the page order is the entity, then the claims, then the relations, then the
  // pending proposals, so the lists below call the register in that order.
  const { refsOf, cards } = sourceRegister(documentById);

  const entitySources = refsOf(entity.sources, `the entity ${entity.label}`);

  const claims = readClaims(entity.attrs);
  const claimSources = claims.map((claim) => ({
    claim,
    sources: refsOf(claim.sources, `${claim.label} of ${entity.label}`, false),
  }));

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
  const fromFarEndOf = (relation: Relation): boolean =>
    relation.dstKind === 'entity' &&
    relation.dstId === entityId &&
    !(relation.srcKind === 'entity' && relation.srcId === entityId);
  const typeWordsOf = (relation: Relation): string => {
    const words = index.wordsOf(relation.type);
    return fromFarEndOf(relation) ? words.inverseLabel : words.label;
  };
  const sentenceOf = (relation: Relation): string => {
    const from = endpointWords(index, relation.srcKind, relation.srcId, 1);
    const to = endpointWords(index, relation.dstKind, relation.dstId, 1);
    const type = typeWordsOf(relation);
    return fromFarEndOf(relation) ? `${to} ${type} ${from}` : `${from} ${type} ${to}`;
  };

  // Two relations link one pair when they have the same two ends, in either direction.
  const pairOf = (relation: Relation): string =>
    [`${relation.srcKind}:${relation.srcId}`, `${relation.dstKind}:${relation.dstId}`]
      .sort()
      .join('|');
  const shown = [...direct, ...pointing];
  const pairCount = new Map<string, number>();
  for (const relation of shown)
    pairCount.set(pairOf(relation), (pairCount.get(pairOf(relation)) ?? 0) + 1);

  const relations: readonly RelationLine[] = shown.map((relation) => {
    const sentence = sentenceOf(relation);
    const fact = factWords(sentence, intervalWords(index, relation));
    return {
      id: relation.id,
      sentence,
      definition: relationDefinition(relation.type),
      typeShown: (pairCount.get(pairOf(relation)) ?? 0) > 1 ? typeWordsOf(relation) : null,
      interval: periodLine(index, relation),
      // The mark comes from the relation and never from the list it is placed in: a relation can
      // be direct and invisible at once.
      undrawable: relation.srcKind === 'relation' || relation.dstKind === 'relation',
      share: shareWords(relation.attrs),
      facts: storedFacts(relation),
      sources: refsOf(relation.sources, fact),
    };
  });

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
      // A merge and its undo name the other entity in `names`, and carry no end in the payload.
      case 'merge_entities':
      case 'undo_merge':
        return proposal.names.includes(entityId);
      case 'create_entity':
      case 'update_entity':
      case 'delete_entity':
      case 'map_document':
        return false;
    }
  };

  const pending: readonly PendingLine[] = read.proposals
    .filter((proposal) => proposal.status === 'pending' && names(proposal))
    .map((proposal) => {
      const held =
        proposal.targetId === null ? undefined : index.relationById.get(proposal.targetId);
      const head =
        proposal.payload.kind === 'close'
          ? `Closes the relation on ${proposal.payload.valid_to}`
          : proposal.payload.kind === 'start'
            ? `Starts the relation on ${proposal.payload.valid_from}`
            : proposal.payload.kind === 'source'
              ? 'Adds a source to the relation'
              : proposal.payload.kind === 'retype' && held !== undefined
                ? `Changes the type of the relation from ${held.type} to ${proposal.payload.type}`
                : OP_WORDS[proposal.op];
      const keys = keysOf(proposal.payload);
      const body = keys.length === 0 ? head : `${head}: ${keys.join(', ')}`;
      return {
        id: proposal.id,
        summary: body,
        dissent: proposal.dissent,
        origin: proposerWords(proposal.proposer),
        sources: refsOf(proposal.src, body),
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
      .map((candidate) => ({
        id: candidate.id,
        name: `${candidate.label} — ${typeLabel(candidate.type, types)}`,
      }))
      .sort((one, other) => one.name.localeCompare(other.name)),
  };

  // Where the map draws this entity, and whose point it borrowed. T4 puts the walk in SQL, so
  // this file reads the answer and repeats no rule of it.
  const at = read.positions.find((row) => row.entityId === entity.id);
  const borrowed = at?.parentId ?? null;
  // The flag state of the newest `flags` relation of a vessel with no end date. A relation with no
  // start date ranks last, and a flag state that the list lacks is skipped.
  const openFlagOf = (read: Corpus, vesselId: string): string | null => {
    const open = read.relations
      .filter(
        (one) =>
          one.type === 'flags' &&
          one.dstKind === 'entity' &&
          one.dstId === vesselId &&
          one.srcKind === 'entity' &&
          one.validTo === null,
      )
      .flatMap((one) => {
        const state = read.entities.find((row) => row.id === one.srcId);
        return state === undefined ? [] : [{ label: state.label, from: one.validFrom ?? '' }];
      })
      .sort((one, other) => other.from.localeCompare(one.from));
    return open[0]?.label ?? null;
  };

  // Departure: the map and the entity list are two reads, so the parent can be absent from the
  // list. The point is still borrowed, so the words stand and only the name falls back.
  const positionFrom =
    borrowed === null
      ? null
      : `Position borrowed from ${nameOf(read, borrowed)} (no own position recorded)`;
  const claimDocuments = new Set(Object.values(entity.attrs).flatMap((one) => one.src));
  const affiliation = entity.attrs['affiliation']?.v;

  return {
    entityId: entity.id,
    label: entity.label,
    type: entity.type,
    typeName: typeLabel(entity.type, types),
    proposedType: entity.proposedType,
    drawnOnMap: (at?.point ?? null) !== null,
    positionFrom,
    positionChain: borrowed === null ? [] : parentChain(read, entity.id, borrowed),
    affiliation: typeof affiliation === 'string' ? affiliation : null,
    sourceDay: newestDay(read.documents.filter((one) => claimDocuments.has(one.id))),
    identity: vesselIdentity(entity.type, entity.attrs, openFlagOf(read, entity.id)),
    decision: decisionOf(entity.promotedFrom, decided),
    rows,
    entitySources,
    sources,
    relations,
    pending,
    linkChoices,
    typeChoices: typeChoicesOf(types, entity.type),
    facts: null,
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
  /** What the type of the relation means, or `null` for a type with no definition. */
  readonly definition: string | null;
  /** M6, written at both ends. `null` where the relation carries no interval at all. */
  readonly interval: string | null;
  /** The share of an ownership link in words, or `null` where the relation holds no share. */
  readonly share: string | null;
  /** Each other stored attribute of the relation, as "Key: value". Empty where there is none. */
  readonly facts: readonly string[];
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
  const interval = intervalWords(index, relation);
  const fact = factWords(`${from} ${type} ${to}`, interval);
  const sources = register.refsOf(relation.sources, fact);
  // Departure: this view draws no attribute, so no document holds one up here. The card says
  // that in its own words.
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
    definition: relationDefinition(relation.type),
    interval: periodLine(index, relation),
    share: shareWords(relation.attrs),
    facts: storedFacts(relation),
    sources,
    cards,
  };
}
