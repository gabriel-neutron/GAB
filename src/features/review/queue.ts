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
  Relation,
} from '@/shared/read/model';

/** What an act does to the graph. The operation alone does not say which risk it carries. */
export type ChangeKind = 'add' | 'edit' | 'delete' | 'merge';

/** What is being changed. The queue lists these, and never one act on its own. */
export type SubjectKind = 'node' | 'new-node' | 'link' | 'merge';

/** A verdict of the pass. Nothing on this surface writes one to the record. */
export type Verdict = 'promoted' | 'rejected' | 'deferred';

export interface Decision {
  readonly verdict: Verdict;
  /** Written on a hold, and empty on the other two. It is collected, so it is drawn. */
  readonly reason: string;
}

/** Keyed on the identifier of the act. A pass holds it, and a reload loses it. */
export type Verdicts = Readonly<Record<string, Decision>>;

/** The key is an identifier the record supplies, and the record admits any text. An inherited
 * name of `Object`, such as `constructor`, must never read as a decision of the analyst. */
export const verdictOf = (verdicts: Verdicts, id: string): Decision | null =>
  Object.hasOwn(verdicts, id) ? (verdicts[id] ?? null) : null;

/** Why this act stands in front of the analyst. */
export type Routing = 'dissent' | 'low-confidence' | 'both' | 'neither' | 'unstated';

/** What the screen cannot show. The kind chooses the mark, and the sentence stays on the mark. */
export type HoleKind =
  'argument' | 'duplicate' | 'link-sources' | 'merge-result' | 'destroyed-row' | 'absent-row';

export interface Hole {
  readonly kind: HoleKind;
  /** Two or three words, for the one line at the foot of a card. */
  readonly short: string;
  /** The whole reason, which reaches a reader by title and by an unseen span. */
  readonly long: string;
}

export interface CitedDocument {
  readonly id: DocId;
  readonly title: string;
  /** The archive copy first: it was taken at ingest, and it cannot drift or disappear. */
  readonly href: string | null;
  readonly rated: boolean;
  /** `not rated` where it is not rated. Never a dash, and never a zero. */
  readonly score: string;
  readonly scoreOrigin: string;
  /** A low letter or a high figure. The hue marks this, and never the absence of a rating. */
  readonly poor: boolean;
  /** Cited, and with no row in the record. It is drawn, because dropped evidence is worse. */
  readonly missing: boolean;
  /** The whole line, for the badge that draws the rating alone. */
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
}

/** One value of the row as it stands, for the pane that draws the subject. */
export interface StandingRow {
  readonly key: string;
  readonly value: string;
  readonly sources: string;
}

/** The self-report of the machine, as one value. An act states a confidence, or it states none,
 * and the two cases carry different fields: a figure with no track cannot be built. */
export type ConfidenceReport =
  | { readonly stated: false; readonly words: string }
  | {
      readonly stated: true;
      /** Already formatted. A drawing file of this surface calls no `toFixed`. */
      readonly figure: string;
      /** 0 to 100, for the track. */
      readonly fill: number;
      readonly words: string;
    };

export interface Change {
  readonly id: string;
  readonly kind: ChangeKind;
  readonly kindWords: string;
  /** What the act does, in one line, for a payload that no table can put side by side. */
  readonly headline: string;
  /** The keys this act names, for the line of one act in a list. Blank where it names none. */
  readonly keysWords: string;
  readonly rows: readonly DifferenceRow[];
  readonly confidenceReport: ConfidenceReport;
  /** The confidence as the record states it. The sort reads this, and never the printed figure. */
  readonly score: number | null;
  readonly routing: Routing;
  readonly routingWords: string;
  /** Two or three words beside the mark of the routing. Blank where no mark is drawn. */
  readonly routingShort: string;
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

export type SortKey = 'confidence' | 'oldest' | 'name';

export const SORT_WORDS: Readonly<Record<SortKey, string>> = {
  confidence: 'weakest first',
  oldest: 'oldest first',
  name: 'name',
};

export const SORT_KEYS: readonly SortKey[] = ['confidence', 'oldest', 'name'];

export const isSortKey = (value: unknown): value is SortKey => SORT_KEYS.includes(value as SortKey);

const KIND_WORDS: Readonly<Record<ChangeKind, string>> = {
  add: 'Addition',
  edit: 'Modification',
  delete: 'Deletion',
  merge: 'Merge',
};

const SUBJECT_WORDS: Readonly<Record<SubjectKind, string>> = {
  node: 'Entity',
  'new-node': 'New entity',
  link: 'Relation',
  merge: 'Merge',
};

const KIND_OF_OP: Readonly<Record<ProposalOp, ChangeKind>> = {
  create_entity: 'add',
  create_relation: 'add',
  update_attrs: 'edit',
  update_relation: 'edit',
  delete_entity: 'delete',
  delete_relation: 'delete',
  merge_entities: 'merge',
};

/** What the act does to the row, and not what its operation is called. An update that names
 * only keys the record does not hold adds them, whatever the name of the operation says. */
function kindOf(op: ProposalOp, rows: readonly DifferenceRow[]): ChangeKind {
  const stated = KIND_OF_OP[op];
  if (stated !== 'edit' || rows.length === 0) return stated;
  if (rows.every((row) => row.op === 'add')) return 'add';
  if (rows.every((row) => row.op === 'remove')) return 'delete';
  return 'edit';
}

/** An identifier is never read in full. Eight characters tell two rows apart. */
const short = (id: string): string => id.slice(0, 8);

function words(value: AttributeValue): string {
  if (Array.isArray(value)) return (value as readonly (string | number)[]).join(', ');
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}

/** A value the record states, or `null`. A string of spaces states nothing a reader can read. */
const statedText = (value: string | null): string | null =>
  value === null || value.trim() === '' ? null : value;

/** The letter is the reliability of the source and the figure the credibility of the report.
 * The last two bands of each are the poor ones, and they carry the hue. */
function poorBand(admiralty: string): boolean {
  const [letter, digit] = [admiralty.slice(0, 1).toUpperCase(), Number(admiralty.slice(1, 2))];
  return ['D', 'E', 'F'].includes(letter) || (Number.isFinite(digit) && digit >= 4);
}

/** The rating and its origin are absent together. An unrated document says so in words, because
 * an absence that reads as a low score turns a hole into a judgement. */
function rating(row: DocumentRow | undefined): {
  rated: boolean;
  score: string;
  scoreOrigin: string;
  poor: boolean;
} {
  const absent = { rated: false, score: 'not rated', scoreOrigin: '', poor: false };
  if (row === undefined) return absent;
  // A blank string is an absent rating and never a rating: a badge drawn from one carries no word.
  const held = statedText(row.admiralty);
  const origin = statedText(row.admiraltyOrigin);
  if (held !== null && origin !== null) {
    return { rated: true, score: held, scoreOrigin: origin, poor: poorBand(held) };
  }
  if (held === null && origin === null) return absent;
  return {
    rated: false,
    score: 'rating incomplete',
    scoreOrigin: 'a rating and its origin are absent together',
    poor: false,
  };
}

interface Index {
  readonly documentById: ReadonlyMap<DocId, DocumentRow>;
  readonly entityById: ReadonlyMap<string, Entity>;
  readonly relationById: ReadonlyMap<string, Relation>;
}

const entityWords = (index: Index, id: string | null): string =>
  id === null
    ? 'an element the act does not name'
    : (index.entityById.get(id)?.label ?? `an entity absent from the record, ${short(id)}`);

function citedDocuments(index: Index, ids: readonly DocId[]): readonly CitedDocument[] {
  return ids.map((id) => {
    const row = index.documentById.get(id);
    const held = rating(row);
    const title = row?.title ?? `Cited document ${id}, absent from the record`;
    const origin = held.scoreOrigin === '' ? '' : `, rated by the ${held.scoreOrigin}`;
    return {
      id,
      title,
      href: row?.archiveUri ?? row?.uri ?? null,
      rated: held.rated,
      score: held.score,
      scoreOrigin: held.scoreOrigin,
      poor: held.poor,
      missing: row === undefined,
      name: `${title}. ${held.score}${origin}.`,
    };
  });
}

const sourceWords = (ids: readonly DocId[]): string => ids.join(', ');

function standingRows(attrs: Attributes): readonly StandingRow[] {
  return Object.entries(attrs).map(([key, attribute]) => ({
    key,
    value: words(attribute.v),
    sources: sourceWords(attribute.src),
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

function routingOf(proposal: Proposal, threshold: number | null): Routing {
  if (threshold === null || proposal.confidence === null) {
    return proposal.dissent ? 'dissent' : 'unstated';
  }
  const low = proposal.confidence < threshold;
  if (proposal.dissent && low) return 'both';
  if (proposal.dissent) return 'dissent';
  return low ? 'low-confidence' : 'neither';
}

const ROUTING_WORDS: Readonly<Record<Routing, string>> = {
  dissent: 'Here because the agents disagreed.',
  'low-confidence': 'Here because the confidence is under the threshold in force.',
  both: 'Here because the agents disagreed, and the confidence is under the threshold.',
  neither: 'Neither condition sends this act to review, and no act is promoted without a person.',
  unstated: 'This screen holds no threshold, so it cannot say why the act is in front of you.',
};

const ROUTING_SHORT: Readonly<Record<Routing, string>> = {
  dissent: 'disagreed',
  'low-confidence': 'under threshold',
  both: 'disagreed, under threshold',
  neither: 'neither condition',
  unstated: 'reason unstated',
};

const HOLE: Readonly<Record<HoleKind, Hole>> = {
  argument: {
    kind: 'argument',
    short: 'the disagreement is not recorded',
    long: 'The record holds that the agents disagreed, and neither side of it: not who objected, and not what it asked for instead.',
  },
  duplicate: {
    kind: 'duplicate',
    short: 'a duplicate row',
    long: 'The act cannot say whether the record already holds this row under another label.',
  },
  'link-sources': {
    kind: 'link-sources',
    short: 'the sources of the link',
    long: 'A relation act names no attribute, so nothing says which documents hold the link up.',
  },
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

/** A node collects its acts. Everything else stands alone, under the identifier of the act. */
function filingOf(proposal: Proposal): Filing {
  switch (proposal.payload.kind) {
    case 'entity':
      return { key: proposal.id, kind: 'new-node' };
    case 'merge':
      return { key: proposal.id, kind: 'merge' };
    case 'relation':
      return { key: proposal.targetId ?? proposal.id, kind: 'link' };
    case 'attrs':
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

function confidenceOf(self: number | null): ConfidenceReport {
  if (self === null) return { stated: false, words: 'The act states no confidence.' };
  const figure = self.toFixed(2);
  return {
    stated: true,
    figure,
    fill: Math.round(self * 100),
    words: `The machine reports a confidence of ${figure}.`,
  };
}

function changeOf(index: Index, proposal: Proposal, threshold: number | null): Change {
  const target = targetOf(index, proposal);
  const payload = proposal.payload;
  // A hole that every act carries is not a hole a reader can act on. Only what this act lacks.
  const holes: Hole[] = [];
  if (proposal.dissent) holes.push(HOLE.argument);

  let headline = '';
  let rows: readonly DifferenceRow[] = [];

  switch (payload.kind) {
    case 'attrs':
      rows = differenceOf(index, target?.attrs ?? null, payload.attrs);
      // Every key of such an act reads as new, which is true of each key and not of the act.
      // The kind stays what the keys say, and this hole carries the fault the kind cannot.
      if (proposal.targetId !== null && target === null) holes.push(HOLE['absent-row']);
      break;
    case 'entity':
      headline = `A new ${payload.type ?? 'entity, of a type the act does not name'}`;
      rows = differenceOf(index, null, payload.attrs);
      holes.push(HOLE.duplicate);
      break;
    case 'relation':
      headline = `${entityWords(index, payload.src_id)} ${payload.type ?? 'is linked to'} ${entityWords(index, payload.dst_id)}`;
      holes.push(HOLE['link-sources']);
      break;
    case 'merge':
      headline = `${payload.merge_ids.map((id) => entityWords(index, id)).join(', ')} into ${entityWords(index, payload.keep_id)}`;
      holes.push(HOLE['merge-result']);
      break;
    case 'delete':
      headline = payload.reason ?? 'The act gives no reason';
      rows = target === null ? [] : destroyed(index, target.attrs);
      if (target === null) holes.push(HOLE['destroyed-row']);
      break;
  }

  const routing = routingOf(proposal, threshold);
  const kind = kindOf(proposal.op, rows);
  const report = confidenceOf(proposal.confidence);
  return {
    id: proposal.id,
    kind,
    kindWords: KIND_WORDS[kind],
    headline,
    keysWords: rows.map((row) => row.key).join(', '),
    rows,
    confidenceReport: report,
    score: proposal.confidence,
    routing,
    routingWords: ROUTING_WORDS[routing],
    routingShort: ROUTING_SHORT[routing],
    sources: citedDocuments(index, proposal.src),
    holes,
    createdAt: proposal.createdAt,
  };
}

function labelOf(index: Index, kind: SubjectKind, key: string, first: Change): string {
  switch (kind) {
    case 'node':
      return index.entityById.get(key)?.label ?? `An entity absent from the record, ${short(key)}`;
    case 'new-node':
    case 'merge':
      return first.headline;
    case 'link': {
      const relation = index.relationById.get(key);
      if (relation === undefined) return first.headline === '' ? short(key) : first.headline;
      return `${entityWords(index, relation.srcId)} ${relation.type} ${entityWords(index, relation.dstId)}`;
    }
  }
}

/** An act that states no confidence sorts as the strongest: an absence is not a low score. The
 * number the record states is read, and never the printed figure: two figures round to one. */
const scoreOf = (change: Change): number => change.score ?? 1;

/** The weakest act is read first inside a subject: it is the one that costs attention. */
const weakestFirst = (a: Change, b: Change): number => scoreOf(a) - scoreOf(b);

function contestedKeysOf(changes: readonly Change[]): readonly string[] {
  const counted = new Map<string, number>();
  for (const change of changes) {
    for (const row of change.rows) counted.set(row.key, (counted.get(row.key) ?? 0) + 1);
  }
  return [...counted].filter(([, count]) => count > 1).map(([key]) => key);
}

/** Everything that waits for a decision, grouped by what it changes. The threshold is an
 * operational parameter, so it enters here and is never a constant of this file. */
export function readQueue(read: Corpus, threshold: number | null): readonly Subject[] {
  const index: Index = {
    documentById: new Map(read.documents.map((row) => [row.id, row])),
    entityById: new Map(read.entities.map((row) => [row.id, row])),
    relationById: new Map(read.relations.map((row) => [row.id, row])),
  };

  const filed = new Map<string, { kind: SubjectKind; changes: Change[] }>();
  for (const proposal of read.proposals) {
    if (proposal.status !== 'pending') continue;
    const { key, kind } = filingOf(proposal);
    const held = filed.get(key) ?? { kind, changes: [] };
    held.changes.push(changeOf(index, proposal, threshold));
    filed.set(key, held);
  }

  return [...filed].flatMap(([key, held]) => {
    const changes = [...held.changes].sort(weakestFirst);
    const [first] = changes;
    // A key exists because an act was filed under it. This narrows the type, and guards nothing.
    if (first === undefined) return [];
    const entity = held.kind === 'node' ? index.entityById.get(key) : undefined;
    const relation = held.kind === 'link' ? index.relationById.get(key) : undefined;
    const standing = entity?.attrs ?? relation?.attrs ?? null;
    const contestedKeys = contestedKeysOf(changes);
    return [
      {
        id: key,
        kind: held.kind,
        kindWords: SUBJECT_WORDS[held.kind],
        label: labelOf(index, held.kind, key, first),
        type: entity?.type ?? relation?.type ?? null,
        standing: standing === null ? [] : standingRows(standing),
        changes,
        contested: contestedKeys.length > 0,
        contestedKeys,
      },
    ];
  });
}

/** The lowest confidence of a subject. A subject is only as sound as its weakest act. */
const weakestOf = (subject: Subject): number => Math.min(...subject.changes.map(scoreOf));

const oldestOf = (subject: Subject): string =>
  [...subject.changes].map((change) => change.createdAt).sort()[0] ?? '';

export function sortSubjects(subjects: readonly Subject[], key: SortKey): readonly Subject[] {
  const sorted = [...subjects];
  switch (key) {
    case 'confidence':
      return sorted.sort((a, b) => weakestOf(a) - weakestOf(b));
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

export interface Focus {
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
const KIND_ORDER: readonly ChangeKind[] = ['delete', 'merge', 'add', 'edit'];

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

/** Where the act stands on this pass. A line waits, or it carries a verdict and the words of it. */
export type LineVerdict =
  | { readonly state: 'waiting' }
  | { readonly state: 'decided'; readonly verdict: Verdict; readonly words: string };

/** One line of an act, inside the subject. It says what the act names, and never its evidence. */
export interface ChangeLine {
  readonly id: string;
  readonly kind: ChangeKind;
  readonly kindWords: string;
  readonly words: string;
  readonly confidenceReport: ConfidenceReport;
  readonly verdict: LineVerdict;
  readonly contested: boolean;
}

/** The one vocabulary of the three acts. A hold is a state of this pass, and never a row of the
 * record, so every word here says "on this pass". */
export const VERDICT_WORDS: Readonly<Record<Verdict, string>> = {
  promoted: 'Promoted on this pass',
  rejected: 'Rejected on this pass',
  deferred: 'Held on this pass',
};

export function changeLines(subject: Subject, verdicts: Verdicts): readonly ChangeLine[] {
  return subject.changes.map((change) => {
    const held = verdictOf(verdicts, change.id);
    return {
      id: change.id,
      kind: change.kind,
      kindWords: change.kindWords,
      words: change.keysWords === '' ? change.headline : change.keysWords,
      confidenceReport: change.confidenceReport,
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
