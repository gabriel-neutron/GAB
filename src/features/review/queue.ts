/** The queue, in domain words. It groups what waits by what is changed, and it decides nothing:
 * where the record cannot answer, it returns the hole as a sentence and the view prints it. */

import type {
  AttributeValue,
  Attributes,
  Corpus,
  DocId,
  DocumentRow,
  Entity,
  Proposal,
  ProposalOp,
  ProposedGeometry,
  Relation,
  TypeVocabulary,
} from '@/shared/read/model';
import { relationWording } from '@/shared/relation-words';

import { payloadHeadline, relationPhrase, shortId, type TypeWordsOf } from './act-words';

/** What an act does to the graph. The operation alone does not say which risk it carries. */
export type ChangeKind = 'add' | 'edit' | 'delete' | 'merge' | 'map';

/** What is being changed. The queue lists these, and never one act on its own. A batch holds the
 * acts of a machine that name each other, and the operator decides them as one unit. */
export type SubjectKind = 'node' | 'new-node' | 'link' | 'merge' | 'batch' | 'mapping';

/** A verdict on one act. Both are written to the record and cannot be taken back. */
export type Verdict = 'promoted' | 'rejected';

export interface Decision {
  readonly verdict: Verdict;
}

/** Keyed on the identifier of the act, which is the identifier of the proposal. A pass holds
 * this map, and a reload loses it: a decided act leaves the queue. */
export type Verdicts = Readonly<Record<string, Decision>>;

/** The key is an identifier the record supplies, and the record admits any text. An inherited
 * name of `Object`, such as `constructor`, must never read as a decision of the analyst. */
export const verdictOf = (verdicts: Verdicts, id: string): Decision | null =>
  Object.hasOwn(verdicts, id) ? (verdicts[id] ?? null) : null;

/** What the screen cannot show. The kind chooses the mark, and the sentence stays on the mark. */
export type HoleKind = 'merge-result' | 'destroyed-row' | 'absent-row';

export interface Hole {
  readonly kind: HoleKind;
  /** Two or three words, for the one line at the foot of a card. */
  readonly short: string;
  /** The whole reason, which reaches a reader by title and by an unseen span. */
  readonly long: string;
}

/** Where the link of a cited document goes. The copy was taken at ingest; the original is the
 * live page, which can change after ingest. The two carry different labels. */
type SourceAddress =
  | { readonly kind: 'ingest-copy'; readonly href: string }
  | { readonly kind: 'original'; readonly href: string };

export interface CitedDocument {
  readonly id: DocId;
  readonly title: string;
  /** The copy taken at ingest first. Null where the record holds no address. */
  readonly address: SourceAddress | null;
  /** Cited, and with no row in the record. It is drawn, because dropped evidence is worse. */
  readonly missing: boolean;
  /** The whole line, for the badge that draws a glyph alone. */
  readonly name: string;
}

/** What one line of the difference does to a key of the row. */
export type RowOp = 'add' | 'edit' | 'remove';

/** One line of the difference: the value that stands, and the value the act asks for. */
export interface DifferenceRow {
  readonly key: string;
  readonly op: RowOp;
  /** Blank where the key does not stand today. An absence must never read as a fault. */
  readonly standing: string | null;
  readonly standingSources: readonly CitedDocument[];
  /** Blank where the act takes the key away. */
  readonly proposed: string | null;
  readonly proposedSources: readonly CitedDocument[];
  /** Departure: the value a promotion stores differs from the one proposed. */
  readonly note?: string;
}

/** One value of the row as it stands, for the pane that draws the subject. */
export interface StandingRow {
  readonly key: string;
  readonly value: string;
  readonly sources: readonly CitedDocument[];
}

export interface Change {
  readonly id: string;
  readonly kind: ChangeKind;
  readonly kindWords: string;
  readonly headline: string;
  /** The keys this act names, for the line of one act in a list. Blank where it names none. */
  readonly keysWords: string;
  readonly rows: readonly DifferenceRow[];
  /** The promotion replaces this list whole, and it also backs the location the act does not
   * name. Null where the act leaves the list as it stands, or names no column. */
  readonly rowSources: {
    readonly words: string;
    readonly before: readonly CitedDocument[];
    readonly after: readonly CitedDocument[];
  } | null;
  /** A check disputes the act. */
  readonly disputed: boolean;
  readonly sources: readonly CitedDocument[];
  readonly holes: readonly Hole[];
  readonly createdAt: string;
}

export interface Subject {
  readonly id: string;
  readonly kind: SubjectKind;
  readonly kindWords: string;
  readonly label: string;
  readonly type: string | null;
  /** The row as it stands. Empty where the subject does not stand in the record yet. */
  readonly standing: readonly StandingRow[];
  readonly changes: readonly Change[];
  /** Two acts name one key. This is the case the analyst is here for. */
  readonly contested: boolean;
  readonly contestedKeys: readonly string[];
}

export type SortKey = 'oldest' | 'name';

export const SORT_WORDS: Readonly<Record<SortKey, string>> = {
  oldest: 'oldest first',
  name: 'name',
};

export const SORT_KEYS: readonly SortKey[] = ['oldest', 'name'];

export const isSortKey = (value: unknown): value is SortKey => SORT_KEYS.includes(value as SortKey);

const KIND_WORDS: Readonly<Record<ChangeKind, string>> = {
  add: 'Addition',
  edit: 'Modification',
  delete: 'Deletion',
  merge: 'Merge',
  map: 'Mapping',
};

const SUBJECT_WORDS: Readonly<Record<SubjectKind, string>> = {
  node: 'Entity',
  'new-node': 'New entity',
  link: 'Relation',
  merge: 'Merge',
  batch: 'Linked batch',
  mapping: 'Mapping of a table',
};

const KIND_OF_OP: Readonly<Record<ProposalOp, ChangeKind>> = {
  create_entity: 'add',
  create_relation: 'add',
  update_attrs: 'edit',
  update_entity: 'edit',
  update_relation: 'edit',
  delete_entity: 'delete',
  delete_relation: 'delete',
  merge_entities: 'merge',
  map_document: 'map',
};

/** What the act does to the row, and not what its operation is called. An update that names
 * only keys the record does not hold adds them, whatever the name of the operation says. */
function kindOf(op: ProposalOp, rows: readonly DifferenceRow[]): ChangeKind {
  const stated = KIND_OF_OP[op];
  if (stated !== 'edit' || rows.length === 0) return stated;
  return rows.every((row) => row.op === 'add') ? 'add' : 'edit';
}

function words(value: AttributeValue): string {
  if (Array.isArray(value)) return (value as readonly (string | number)[]).join(', ');
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}

interface Index {
  readonly documentById: ReadonlyMap<DocId, DocumentRow>;
  readonly entityById: ReadonlyMap<string, Entity>;
  /** The name of each new entity that waits. Its promotion keeps the identifier of its act, so a
   * relation of the same batch names it by that identifier before it stands in the record. */
  readonly waitingLabelById: ReadonlyMap<string, string>;
  readonly relationById: ReadonlyMap<string, Relation>;
  readonly liveTypes: ReadonlySet<string> | null;
  readonly typeWordsOf: TypeWordsOf;
}

/** External constraint: a promotion stores a word that is not a live type, a retired type too,
 * as `unknown`, and keeps the word beside it. */
const storedTypeNote = (index: Index, type: string): string | null =>
  index.liveTypes === null || index.liveTypes.has(type)
    ? null
    : `${type} is not a live type, so a promotion stores the type 'unknown' and keeps ${type} beside it`;

const labelIn =
  (index: Index) =>
  (id: string): string | undefined =>
    index.entityById.get(id)?.label ?? index.waitingLabelById.get(id);

function addressOf(row: DocumentRow | undefined): SourceAddress | null {
  if (row === undefined) return null;
  if (row.archiveUri !== null) return { kind: 'ingest-copy', href: row.archiveUri };
  if (row.uri !== null) return { kind: 'original', href: row.uri };
  return null;
}

function citedDocuments(index: Index, ids: readonly DocId[]): readonly CitedDocument[] {
  return ids.map((id) => {
    const row = index.documentById.get(id);
    const title = row?.title ?? `Cited document ${id}, absent from the record`;
    return { id, title, address: addressOf(row), missing: row === undefined, name: title };
  });
}

function standingRows(index: Index, attrs: Attributes): readonly StandingRow[] {
  return Object.entries(attrs).map(([key, attribute]) => ({
    key,
    value: words(attribute.v),
    sources: citedDocuments(index, attribute.src),
  }));
}

/** The difference of an act that names attributes. The live row carries the standing side, and
 * a key the record does not hold is an addition and never a blank line. */
function differenceOf(
  index: Index,
  standing: Attributes | null,
  proposed: Attributes,
): readonly DifferenceRow[] {
  return Object.entries(proposed).map(([key, after]) => {
    // The act writes the key, so a key such as `constructor` reaches this read. An own-property
    // guard keeps an inherited function off the standing side.
    const before = standing !== null && Object.hasOwn(standing, key) ? standing[key] : undefined;
    return {
      key,
      op: before === undefined ? 'add' : 'edit',
      standing: before === undefined ? null : words(before.v),
      standingSources: before === undefined ? [] : citedDocuments(index, before.src),
      proposed: words(after.v),
      proposedSources: citedDocuments(index, after.src),
    };
  });
}

interface Columns {
  readonly label: string | null;
  readonly type: string | null;
}

/** Departure: the row-level list backs the name, the type and the location, so it stands beside
 * each standing value. An upper case key is one that no attribute can take, so a line never reads
 * as contested with a claim. */
function columnsDifference(
  index: Index,
  standing: Entity | null,
  proposed: Columns,
  src: readonly DocId[],
): readonly DifferenceRow[] {
  const before = standing === null ? [] : citedDocuments(index, standing.sources);
  const after = citedDocuments(index, src);
  const row = (key: string, was: string | null, will: string): DifferenceRow => ({
    key,
    op: was === null ? 'add' : 'edit',
    standing: was,
    standingSources: was === null ? [] : before,
    proposed: will,
    proposedSources: after,
  });
  const typed = (type: string): DifferenceRow => {
    const held = row('Type', standing?.type ?? null, type);
    const note = storedTypeNote(index, type);
    return note === null ? held : { ...held, note };
  };
  return [
    ...(proposed.label === null ? [] : [row('Name', standing?.label ?? null, proposed.label)]),
    ...(proposed.type === null ? [] : [typed(proposed.type)]),
  ];
}

const createdColumn = (
  key: string,
  value: string,
  sources: readonly CitedDocument[],
): DifferenceRow => ({
  key,
  op: 'add',
  standing: null,
  standingSources: [],
  proposed: value,
  proposedSources: sources,
});

const geometryWords = (geom: ProposedGeometry): string =>
  geom.kind === 'point'
    ? `latitude ${String(geom.point.lat)}, longitude ${String(geom.point.lon)}`
    : `a ${geom.shape} geometry`;

type EntityPayload = Extract<Proposal['payload'], { readonly kind: 'entity' }>;

function entityCreation(
  index: Index,
  payload: EntityPayload,
  src: readonly DocId[],
): readonly DifferenceRow[] {
  const cited = citedDocuments(index, src);
  const located = payload.geom === null ? null : geometryWords(payload.geom);
  return [
    ...columnsDifference(index, null, payload, src),
    ...(located === null ? [] : [createdColumn('Location', located, cited)]),
    ...differenceOf(index, null, payload.attrs),
  ];
}

type RelationPayload = Extract<Proposal['payload'], { readonly kind: 'relation' }>;

/** Departure: the two ends stand in the headline and in no row. The row-level list backs the
 * type and the two dates, and each key cites its own. */
function relationCreation(
  index: Index,
  payload: RelationPayload,
  src: readonly DocId[],
): readonly DifferenceRow[] {
  const cited = citedDocuments(index, src);
  const stated = (key: string, value: string | null): readonly DifferenceRow[] =>
    value === null ? [] : [createdColumn(key, value, cited)];
  return [
    ...stated('Type', index.typeWordsOf(payload.type)),
    ...stated('Valid from', payload.valid_from),
    ...stated('Valid to', payload.valid_to),
    ...differenceOf(index, null, payload.attrs),
  ];
}

const sameSources = (a: readonly DocId[], b: readonly DocId[]): boolean => {
  const held = new Set(a);
  const cited = new Set(b);
  return held.size === cited.size && [...cited].every((id) => held.has(id));
};

/** The line that says the act replaces the list behind the columns it does not name. Order and
 * repeats in a list change nothing that a list backs, so the two lists compare as sets. */
function rowSourcesOf(
  index: Index,
  standing: Entity | null,
  src: readonly DocId[],
): Change['rowSources'] {
  if (standing === null || sameSources(standing.sources, src)) return null;
  return {
    words: 'Sources of the name, the type and the map location',
    before: citedDocuments(index, standing.sources),
    after: citedDocuments(index, src),
  };
}

/** What a deletion destroys, named key by key. A deletion judged on one side is not judged. */
function destroyed(index: Index, attrs: Attributes): readonly DifferenceRow[] {
  return Object.entries(attrs).map(([key, before]) => ({
    key,
    op: 'remove' as const,
    standing: words(before.v),
    standingSources: citedDocuments(index, before.src),
    proposed: null,
    proposedSources: [],
  }));
}

const HOLE: Readonly<Record<HoleKind, Hole>> = {
  'merge-result': {
    kind: 'merge-result',
    short: 'the merged row',
    long: 'The act names the rows and never the result, so the merged row cannot be drawn.',
  },
  'destroyed-row': {
    kind: 'destroyed-row',
    short: 'the destroyed row is absent',
    long: 'The row this act destroys is absent from the record, so nothing says what stands today, and nothing names what is lost.',
  },
  'absent-row': {
    kind: 'absent-row',
    short: 'the row this act changes is absent',
    long: 'The row this act names is absent from the record, so every key it names reads as new, and nothing says what stands today.',
  },
};

interface Filing {
  readonly key: string;
  readonly kind: SubjectKind;
}

/** A batch collects its acts, and so does a node. Everything else stands alone, under the
 * identifier of the act. */
function filingOf(proposal: Proposal): Filing {
  if (proposal.batchId !== null) return { key: proposal.batchId, kind: 'batch' };
  switch (proposal.payload.kind) {
    case 'entity':
      return { key: proposal.id, kind: 'new-node' };
    case 'merge':
      return { key: proposal.id, kind: 'merge' };
    case 'mapping':
      return { key: proposal.id, kind: 'mapping' };
    case 'relation':
      return { key: proposal.targetId ?? proposal.id, kind: 'link' };
    case 'attrs':
    case 'columns':
    case 'delete':
      if (proposal.targetKind === 'relation' && proposal.targetId !== null) {
        return { key: proposal.targetId, kind: 'link' };
      }
      return { key: proposal.targetId ?? proposal.id, kind: 'node' };
  }
}

function targetOf(index: Index, proposal: Proposal): Entity | Relation | null {
  if (proposal.targetId === null) return null;
  if (proposal.targetKind === 'entity') return index.entityById.get(proposal.targetId) ?? null;
  if (proposal.targetKind === 'relation') return index.relationById.get(proposal.targetId) ?? null;
  return null;
}

function changeOf(index: Index, proposal: Proposal): Change {
  const target = targetOf(index, proposal);
  const payload = proposal.payload;
  // A hole that every act carries is not a hole a reader can act on. Only what this act lacks.
  const holes: Hole[] = [];

  let headline = '';
  let rows: readonly DifferenceRow[] = [];
  let rowSources: Change['rowSources'] = null;

  switch (payload.kind) {
    case 'attrs':
      rows = differenceOf(index, target?.attrs ?? null, payload.attrs);
      // Every key of such an act reads as new, which is true of each key and not of the act.
      // The kind stays what the keys say, and this hole carries the fault the kind cannot.
      if (proposal.targetId !== null && target === null) holes.push(HOLE['absent-row']);
      break;
    case 'columns': {
      const entity =
        proposal.targetId === null ? undefined : index.entityById.get(proposal.targetId);
      rows = columnsDifference(index, entity ?? null, payload, proposal.src);
      rowSources = rows.length === 0 ? null : rowSourcesOf(index, entity ?? null, proposal.src);
      if (proposal.targetId !== null && entity === undefined) holes.push(HOLE['absent-row']);
      break;
    }
    case 'entity':
      headline = `A new ${payload.type}`;
      rows = entityCreation(index, payload, proposal.src);
      break;
    case 'relation':
      headline = payloadHeadline(labelIn(index), index.typeWordsOf, payload);
      rows = relationCreation(index, payload, proposal.src);
      break;
    case 'merge':
      headline = payloadHeadline(labelIn(index), index.typeWordsOf, payload);
      holes.push(HOLE['merge-result']);
      break;
    case 'mapping':
      headline = `The mapping of ${payload.table ?? 'a table the act does not name'}`;
      break;
    case 'delete':
      headline = payload.reason ?? 'The act gives no reason';
      rows = target === null ? [] : destroyed(index, target.attrs);
      if (target === null) holes.push(HOLE['destroyed-row']);
      break;
  }

  const kind = kindOf(proposal.op, rows);
  return {
    id: proposal.id,
    kind,
    kindWords: KIND_WORDS[kind],
    headline,
    keysWords: rows.map((row) => row.key).join(', '),
    rows,
    rowSources,
    disputed: proposal.dissent,
    sources: citedDocuments(index, proposal.src),
    holes,
    createdAt: proposal.createdAt,
  };
}

const newNameOf = (change: Change): string | undefined =>
  change.rows.find((row) => row.key === 'Name')?.proposed ?? undefined;

function labelOf(
  index: Index,
  kind: SubjectKind,
  key: string,
  changes: readonly [Change, ...Change[]],
): string {
  const [first] = changes;
  switch (kind) {
    case 'node':
      return (
        index.entityById.get(key)?.label ?? `An entity absent from the record, ${shortId(key)}`
      );
    case 'new-node':
      return newNameOf(first) ?? first.headline;
    case 'batch': {
      const named = changes.flatMap((change) => newNameOf(change) ?? []);
      return named.length === 0 ? first.headline : named.join(', ');
    }
    case 'merge':
    case 'mapping':
      return first.headline;
    case 'link': {
      const relation = index.relationById.get(key);
      if (relation === undefined) return first.headline === '' ? shortId(key) : first.headline;
      return relationPhrase(
        labelIn(index),
        index.typeWordsOf,
        { kind: relation.srcKind, id: relation.srcId },
        relation.type,
        { kind: relation.dstKind, id: relation.dstId },
      );
    }
  }
}

const oldestFirst = (a: Change, b: Change): number => a.createdAt.localeCompare(b.createdAt);

function contestedKeysOf(changes: readonly Change[]): readonly string[] {
  const counted = new Map<string, number>();
  for (const change of changes) {
    for (const row of change.rows) counted.set(row.key, (counted.get(row.key) ?? 0) + 1);
  }
  return [...counted].filter(([, count]) => count > 1).map(([key]) => key);
}

/** Everything that waits for a decision, grouped by what it changes. */
export function readQueue(read: Corpus, types?: TypeVocabulary): readonly Subject[] {
  const wordsOf = relationWording(read.relationTypes);
  const index: Index = {
    documentById: new Map(read.documents.map((row) => [row.id, row])),
    entityById: new Map(read.entities.map((row) => [row.id, row])),
    waitingLabelById: new Map(
      read.proposals.flatMap((proposal) =>
        proposal.status === 'pending' && proposal.payload.kind === 'entity'
          ? [[proposal.id, proposal.payload.label] as const]
          : [],
      ),
    ),
    relationById: new Map(read.relations.map((row) => [row.id, row])),
    liveTypes:
      types === undefined
        ? null
        : new Set(types.filter((type) => !type.retired).map((type) => type.key)),

    typeWordsOf: (type) => wordsOf(type).label,
  };

  const filed = new Map<string, { kind: SubjectKind; changes: Change[] }>();
  for (const proposal of read.proposals) {
    if (proposal.status !== 'pending') continue;
    const { key, kind } = filingOf(proposal);
    const held = filed.get(key) ?? { kind, changes: [] };
    held.changes.push(changeOf(index, proposal));
    filed.set(key, held);
  }

  return [...filed].flatMap(([key, held]) => {
    const changes = [...held.changes].sort(oldestFirst);
    const [first, ...rest] = changes;
    // A key exists because an act was filed under it. This narrows the type, and guards nothing.
    if (first === undefined) return [];
    const entity = held.kind === 'node' ? index.entityById.get(key) : undefined;
    const relation = held.kind === 'link' ? index.relationById.get(key) : undefined;
    const standing = entity?.attrs ?? relation?.attrs ?? null;
    // The acts of a batch change different rows, so a key that two of them name is no contest.
    const contestedKeys = held.kind === 'batch' ? [] : contestedKeysOf(changes);
    return [
      {
        id: key,
        kind: held.kind,
        kindWords: SUBJECT_WORDS[held.kind],
        label: labelOf(index, held.kind, key, [first, ...rest]),
        type: entity?.type ?? relation?.type ?? null,
        standing: standing === null ? [] : standingRows(index, standing),
        changes,
        contested: contestedKeys.length > 0,
        contestedKeys,
      },
    ];
  });
}

/** The name of a linked batch, which says how many acts one verdict decides. */
export const batchName = (subject: Subject): string =>
  `One linked batch of ${String(subject.changes.length)} acts`;

/** The acts that one verdict on a batch decides. */
export const actIdsOf = (subject: Subject): readonly string[] =>
  subject.changes.map((change) => change.id);

const oldestOf = (subject: Subject): string =>
  [...subject.changes].map((change) => change.createdAt).sort()[0] ?? '';

export function sortSubjects(subjects: readonly Subject[], key: SortKey): readonly Subject[] {
  const sorted = [...subjects];
  switch (key) {
    case 'oldest':
      return sorted.sort((a, b) => oldestOf(a).localeCompare(oldestOf(b)));
    case 'name':
      return sorted.sort((a, b) => a.label.localeCompare(b.label));
  }
}

/** The subject the address names, or the first of the queue when it names none. */
export function subjectOf(subjects: readonly Subject[], id: string | null): Subject | null {
  return subjects.find((subject) => subject.id === id) ?? subjects[0] ?? null;
}

interface Focus {
  readonly current: Change | null;
  /** The other acts that name a key this one names. They are read beside it, never after it. */
  readonly beside: readonly Change[];
}

/** The act the controls act on, and the acts that contradict it. Two acts on one row are the
 * reason the row is the unit, and a surface that draws them one at a time cannot compare them. */
export function focusOf(subject: Subject | null, changeId: string | null): Focus {
  if (subject === null) return { current: null, beside: [] };
  const current = subject.changes.find((change) => change.id === changeId) ?? subject.changes[0];
  if (current === undefined) return { current: null, beside: [] };
  const keys = current.rows
    .map((row) => row.key)
    .filter((key) => subject.contestedKeys.includes(key));
  return {
    current,
    beside: subject.changes.filter(
      (change) => change.id !== current.id && change.rows.some((row) => keys.includes(row.key)),
    ),
  };
}

/** How many acts of one kind a subject carries. A count of nothing is never drawn. */
export interface KindCount {
  readonly kind: ChangeKind;
  readonly count: number;
  /** The kind in one word, so no drawing file holds a second list of these four words. */
  readonly words: string;
}

export interface SubjectRow {
  readonly id: string;
  readonly label: string;
  /** One per kind the subject carries, in the order delete, merge, add, edit. Never a zero. */
  readonly counts: readonly KindCount[];
  /** The hue of the row. A subject that carries several kinds takes the costliest of them. */
  readonly rule: ChangeKind;
  /** 0 to 100, for the track that says how much of a subject is settled. */
  readonly settledFill: number;
  /** The row is one line, so the whole count is said here for a reader who hears the row. */
  readonly name: string;
  readonly contested: boolean;
}

/** The order a count is drawn in, and the order that decides the hue of a row: the act that
 * destroys is read before the act that adds, and both before the act that edits. */
const KIND_ORDER: readonly ChangeKind[] = ['delete', 'merge', 'add', 'map', 'edit'];

const settledIn = (subject: Subject, verdicts: Verdicts): number =>
  subject.changes.filter((change) => verdictOf(verdicts, change.id) !== null).length;

export function railRows(subjects: readonly Subject[], verdicts: Verdicts): readonly SubjectRow[] {
  return subjects.map((subject) => {
    const total = subject.changes.length;
    const settled = settledIn(subject, verdicts);
    const contested = subject.contested ? ', and two acts contest one key' : '';
    const counts = KIND_ORDER.map((kind) => ({
      kind,
      count: subject.changes.filter((change) => change.kind === kind).length,
      words: KIND_WORDS[kind],
    })).filter((held) => held.count > 0);
    const words = counts.map((held) => `${String(held.count)} ${held.words}`).join(', ');
    return {
      id: subject.id,
      label: subject.label,
      counts,
      rule: counts[0]?.kind ?? 'edit',
      // The rail draws no track at zero, so a settled act that rounds down disappears. One of
      // three hundred holds the smallest track, and a true zero stays zero.
      settledFill: settled === 0 ? 0 : Math.max(1, Math.round((settled / total) * 100)),
      name: `${subject.label}, ${subject.kindWords}. ${words}. ${String(total - settled)} of ${String(total)} waiting${contested}`,
      contested: subject.contested,
    };
  });
}

/** Where the act stands. A line waits, or it carries a verdict and the words of that verdict. */
export type LineVerdict =
  | { readonly state: 'waiting' }
  | { readonly state: 'decided'; readonly verdict: Verdict; readonly words: string };

/** One line of an act, inside the subject. It says what the act names, and never its evidence. */
export interface ChangeLine {
  readonly id: string;
  readonly kind: ChangeKind;
  readonly kindWords: string;
  readonly words: string;
  readonly verdict: LineVerdict;
  readonly contested: boolean;
}

/** The one vocabulary of the two verdicts. */
export const VERDICT_WORDS: Readonly<Record<Verdict, string>> = {
  promoted: 'Promoted into the record',
  rejected: 'Rejected in the record',
};

export function changeLines(subject: Subject, verdicts: Verdicts): readonly ChangeLine[] {
  return subject.changes.map((change) => {
    const held = verdictOf(verdicts, change.id);
    return {
      id: change.id,
      kind: change.kind,
      kindWords: change.kindWords,
      words: change.keysWords === '' ? change.headline : change.keysWords,
      verdict:
        held === null
          ? { state: 'waiting' as const }
          : {
              state: 'decided' as const,
              verdict: held.verdict,
              words: VERDICT_WORDS[held.verdict],
            },
      contested: change.rows.some((row) => subject.contestedKeys.includes(row.key)),
    };
  });
}
