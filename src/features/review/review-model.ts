/**
 * **PROTOTYPE — throwaway.** It answers one question: is the W5–W6 review of `prd.md` §3
 * painful? It is not the review feature, and no line of it is written to survive.
 *
 * **The unit is the subject, not the change.** An agent produces several proposals against one
 * node, and reviewing them one at a time asks the analyst to hold the node in their head across
 * six screens. So the queue lists what is being changed, and a subject carries every pending
 * change against it. Each change is still accepted or rejected on its own: P1 makes the
 * promotion the pivotal act, and nothing here accepts a group.
 *
 * It reads `@/shared/fixtures/corpus`, which is synthetic, plus `prototype-extra`, which is
 * prototype-only and explains itself. It writes nothing: `spec.md` §5 puts the promotion inside
 * a database function, and a prototype that pretended to promote would lie about the one thing
 * that matters.
 *
 * **It settles no open question.** Where the data or the documents leave a hole, the screen
 * shows the hole and names the ticket.
 */

import { corpus } from '@/shared/fixtures/corpus';
import type {
  Attribute,
  AttributeValue,
  Attributes,
  DocId,
  DocumentRow,
  Entity,
  Proposal,
  ProposalOp,
  Relation,
} from '@/shared/fixtures/types';

import { extraAgentCalls, extraProposals } from './prototype-extra';

const proposals: readonly Proposal[] = [...corpus.proposals, ...extraProposals];
const agentCalls = [...corpus.agentCalls, ...extraAgentCalls];

/**
 * The clock, frozen. The fixture carries fixed dates, so a real clock would make the ages on
 * the screen drift and two runs of the prototype would not compare.
 */
const NOW_MS = Date.parse('2026-08-11T00:00:00Z');

/**
 * **A number this prototype draws with. It decides nothing.**
 *
 * `spec.md` §5 says the threshold is an operational parameter and never a code constant, and §6
 * leaves the value open — #9. The operator removed the control from the review screen on
 * 11 August 2026: a review surface is not where an operational parameter is set. **That removes
 * the control, not the question.** The value below lets a prototype draw a queue, the real one
 * is set outside the source, and this line is deleted with the prototype. #9 stays open.
 */
export const THRESHOLD = 0.5;

/**
 * What a change does to the graph. The operator asked for this to be the strongest signal on
 * the screen: an addition, a modification and a deletion are three different risks, and the raw
 * `op` string does not say which is which at a glance.
 */
export type ChangeKind = 'add' | 'edit' | 'delete' | 'merge';

/** What is being changed. The queue lists these, never the individual changes. */
export type SubjectKind = 'node' | 'new-node' | 'link' | 'merge';

/** A verdict the analyst reaches on the screen. It reaches no database. */
export type LocalVerdict = 'accepted' | 'rejected' | 'deferred';

export interface LocalDecision {
  readonly verdict: LocalVerdict;
  /** Written for a deferral, empty for the other two. */
  readonly reason: string;
}

export type DecisionMap = Readonly<Record<string, LocalDecision>>;

/** How the queue is ordered. ADR 0004 §7 names sort order as workspace, so it is persisted. */
export type SortKey = 'confidence' | 'age' | 'kind' | 'label';

export const SORT_LABEL: Readonly<Record<SortKey, string>> = {
  confidence: 'confidence',
  age: 'oldest',
  kind: 'kind',
  label: 'name',
};

export const SORT_KEYS: readonly SortKey[] = ['confidence', 'age', 'kind', 'label'];

export const isSortKey = (value: unknown): value is SortKey => SORT_KEYS.includes(value as SortKey);

/** A source citation, resolved. `doc` is null when the cited identifier is in no document row. */
export interface ResolvedSource {
  readonly id: DocId;
  readonly doc: DocumentRow | null;
}

/** A quoted extent of a document. See `citedSpans` for why this is a guess and not a field. */
export interface CitedSpan {
  readonly docId: DocId;
  readonly text: string;
}

/** One line of the difference between the subject as it stands and the change proposed. */
export interface AttrChange {
  readonly key: string;
  readonly before: Attribute | null;
  readonly after: Attribute;
}

/** One pending change. It is always read inside a subject, never on its own. */
export interface Change {
  readonly proposal: Proposal;
  readonly kind: ChangeKind;
  /** True when S3 sends this to review on neither condition. The #42 gap. */
  readonly unrouted: boolean;
  readonly lowConfidence: boolean;
  /** One line saying what the change is, when there is no attribute difference to show. */
  readonly summary: string;
  readonly changes: readonly AttrChange[];
  readonly sources: readonly ResolvedSource[];
  readonly spans: readonly CitedSpan[];
  /** `extractor v4`, or `by hand`. An operator edit names an agent that never ran. */
  readonly authorLabel: string;
  /**
   * Exactly what was sent to the model. It is the nearest thing the model holds to "the chat
   * this request came from", and it is not a chat: there is one prompt, no reply, and no turn
   * after it. #16 records it; #45 asks whether a reader may ever see it.
   */
  readonly renderedPrompt: string | null;
  readonly ageDays: number;
  /** What the screen cannot show, and why. Each line names the ticket it belongs to. */
  readonly gaps: readonly string[];
}

/** What is being changed: a standing node, a node that does not exist yet, a link, a merge. */
export interface Subject {
  readonly id: string;
  readonly kind: SubjectKind;
  readonly label: string;
  /** `facility`, `owns`, or null when the payload names no type. */
  readonly type: string | null;
  /** The row as it stands today, when one stands. */
  readonly entity: Entity | null;
  readonly relation: Relation | null;
  readonly changes: readonly Change[];
}

const documentById = (id: DocId): DocumentRow | null =>
  corpus.documents.find((d) => d.id === id) ?? null;

const entityById = (id: string): Entity | null => corpus.entities.find((e) => e.id === id) ?? null;

const relationById = (id: string): Relation | null =>
  corpus.relations.find((r) => r.id === id) ?? null;

const entityLabel = (id: string): string => entityById(id)?.label ?? `unknown ${short(id)}`;

/** An identifier is never read in full. Eight characters is enough to tell two apart. */
export const short = (id: string): string => id.slice(0, 8);

// The age of a change is no longer printed on a card — the operator removed the provenance line
// on 11 August 2026. It survives as a sort key, and `ageDays` stays on `Change` for that.

export function changeKindOf(op: ProposalOp): ChangeKind {
  switch (op) {
    case 'create_entity':
    case 'create_relation':
      return 'add';
    case 'update_attrs':
    case 'update_relation':
      return 'edit';
    case 'delete_entity':
    case 'delete_relation':
      return 'delete';
    case 'merge_entities':
      return 'merge';
  }
}

export const CHANGE_LABEL: Readonly<Record<ChangeKind, string>> = {
  add: 'Addition',
  edit: 'Modification',
  delete: 'Deletion',
  merge: 'Merge',
};

/**
 * **The prototype reads the cited text out of the prompt, because there is no other place.**
 *
 * A `Proposal` carries `src: DocId[]` — identifiers. It carries no quoted extent, no character
 * offset and no page. The only text in the corpus that a card can put in front of an analyst is
 * the `Context (doc_x): "..."` fragment that the agent prompt happens to embed, so this reads it
 * back out with a regular expression.
 *
 * That is not a citation. It is a string a prompt template made, and a change to the template
 * silently empties every card. The finding belongs to #44 and #45.
 */
export function citedSpans(renderedPrompt: string | null): readonly CitedSpan[] {
  if (renderedPrompt === null) return [];
  const found: CitedSpan[] = [];
  const pattern = /Context \(([^)]+)\): "([^"]*)"/g;
  for (const match of renderedPrompt.matchAll(pattern)) {
    const [, docId, text] = match;
    if (docId !== undefined && text !== undefined) found.push({ docId, text });
  }
  return found;
}

export function formatValue(value: AttributeValue): string {
  if (Array.isArray(value)) return (value as readonly (string | number)[]).join(', ');
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}

function attrChanges(current: Attributes | null, proposed: Attributes): readonly AttrChange[] {
  return Object.entries(proposed).map(([key, after]) => ({
    key,
    before: current?.[key] ?? null,
    after,
  }));
}

/** Where a proposal is filed. A node collects its edits; everything else stands alone. */
function subjectKeyOf(proposal: Proposal): { key: string; kind: SubjectKind } {
  const payload = proposal.payload;
  if (payload.kind === 'entity') return { key: proposal.id, kind: 'new-node' };
  if (payload.kind === 'relation') return { key: proposal.id, kind: 'link' };
  if (payload.kind === 'merge') return { key: proposal.id, kind: 'merge' };
  if (proposal.targetKind === 'relation' && proposal.targetId !== null) {
    return { key: proposal.targetId, kind: 'link' };
  }
  return { key: proposal.targetId ?? proposal.id, kind: 'node' };
}

function toChange(proposal: Proposal): Change {
  const call = agentCalls.find((c) => c.id === proposal.callId) ?? null;
  const agent = call === null ? undefined : corpus.agents.find((a) => a.id === call.agentId);
  const payload = proposal.payload;
  const entity =
    proposal.targetKind === 'entity' && proposal.targetId !== null
      ? entityById(proposal.targetId)
      : null;
  const relation =
    proposal.targetKind === 'relation' && proposal.targetId !== null
      ? relationById(proposal.targetId)
      : null;

  const gaps: string[] = [];
  let summary = '';
  let changes: readonly AttrChange[] = [];

  switch (payload.kind) {
    case 'attrs':
      changes = attrChanges(entity?.attrs ?? relation?.attrs ?? null, payload.attrs);
      break;
    case 'entity':
      changes = attrChanges(null, payload.attrs);
      summary = `a new ${payload.type}`;
      if (corpus.entities.some((e) => e.label.toLowerCase() === payload.label.toLowerCase())) {
        gaps.push(
          'A row with this exact label already stands, and the payload cannot say whether it is the same object — #7.',
        );
      }
      break;
    case 'relation':
      summary = `${entityLabel(payload.srcId)} —${payload.type}→ ${entityLabel(payload.dstId)}`;
      gaps.push(
        'The relation payload carries no sources. Nothing says whether the promoted link inherits the proposal’s — #7.',
      );
      break;
    case 'merge':
      summary = `${payload.mergeIds.map(entityLabel).join(', ')} into ${entityLabel(payload.keepId)}`;
      gaps.push(
        'The payload names the rows, never the result. The merged object cannot be shown — #7.',
      );
      break;
    case 'delete':
      summary = payload.reason;
      break;
  }

  return {
    proposal,
    kind: changeKindOf(proposal.op),
    unrouted: !proposal.dissent && proposal.confidence >= THRESHOLD,
    lowConfidence: proposal.confidence < THRESHOLD,
    summary,
    changes,
    sources: proposal.src.map((id) => ({ id, doc: documentById(id) })),
    spans: citedSpans(call?.renderedPrompt ?? null),
    // An operator edit still carries an `agentCall`, and that call names an agent that never
    // ran. The writing role is the only honest reading. Reported.
    authorLabel:
      proposal.authorRole === 'gabriel_app'
        ? 'by hand'
        : agent === undefined
          ? 'no agent named'
          : `${agent.name} v${agent.version}`,
    renderedPrompt: call?.renderedPrompt ?? null,
    ageDays: Math.max(0, Math.round((NOW_MS - Date.parse(proposal.createdAt)) / 86_400_000)),
    gaps,
  };
}

function labelOf(kind: SubjectKind, key: string, first: Change): string {
  switch (kind) {
    case 'node':
      return entityById(key)?.label ?? short(key);
    case 'new-node':
      return first.proposal.payload.kind === 'entity' ? first.proposal.payload.label : short(key);
    case 'link': {
      const relation = relationById(key);
      if (relation !== null) {
        return `${entityLabel(relation.srcId)} —${relation.type}→ ${entityLabel(relation.dstId)}`;
      }
      return first.summary;
    }
    case 'merge':
      return first.summary;
  }
}

function typeOf(kind: SubjectKind, key: string, first: Change): string | null {
  if (kind === 'node') return entityById(key)?.type ?? null;
  if (kind === 'new-node') {
    return first.proposal.payload.kind === 'entity' ? first.proposal.payload.type : null;
  }
  if (kind === 'link') {
    return (
      relationById(key)?.type ??
      (first.proposal.payload.kind === 'relation' ? first.proposal.payload.type : null)
    );
  }
  return null;
}

/** Everything that waits for a decision, grouped by what it changes. */
export function pendingSubjects(): readonly Subject[] {
  const byKey = new Map<string, { kind: SubjectKind; changes: Change[] }>();

  for (const proposal of proposals) {
    if (proposal.status !== 'pending') continue;
    const { key, kind } = subjectKeyOf(proposal);
    const bucket = byKey.get(key) ?? { kind, changes: [] };
    bucket.changes.push(toChange(proposal));
    byKey.set(key, bucket);
  }

  // Inside a subject the weakest change is read first: it is the one that costs attention.
  return [...byKey].flatMap(([key, { kind, changes }]) => {
    const sorted = [...changes].sort((a, b) => a.proposal.confidence - b.proposal.confidence);
    const [first] = sorted;
    // A key exists only because a change was filed under it, so this never happens. It is a
    // narrowing, not a guard.
    if (first === undefined) return [];
    return [
      {
        id: key,
        kind,
        label: labelOf(kind, key, first),
        type: typeOf(kind, key, first),
        entity: kind === 'node' ? entityById(key) : null,
        relation: kind === 'link' ? relationById(key) : null,
        changes: sorted,
      },
    ];
  });
}

/** The lowest confidence in a subject. A subject is only as sound as its weakest change. */
export const subjectConfidence = (subject: Subject): number =>
  Math.min(...subject.changes.map((c) => c.proposal.confidence));

/** One line of the subject's record: the value it holds, and the change waiting on it. */
export interface RecordRow {
  readonly key: string;
  readonly current: Attribute | null;
  /** The change that touches this key, when one does. */
  readonly change: Change | null;
  readonly proposed: Attribute | null;
}

/**
 * The subject read as its own record, with each pending change on the line it touches.
 *
 * This is what the third variation needs. A list of proposals says "four things want to change";
 * a record says "this is the object, and these three of its eleven values are contested". The
 * second is the sentence an analyst has to be able to finish.
 */
export function recordRows(subject: Subject): readonly RecordRow[] {
  const standing = subject.entity?.attrs ?? subject.relation?.attrs ?? {};
  const touched = new Map<string, { change: Change; proposed: Attribute }>();

  for (const change of subject.changes) {
    for (const attr of change.changes) {
      touched.set(attr.key, { change, proposed: attr.after });
    }
  }

  // The record keeps its own order, and a key the change invents is appended. That is what makes
  // this a record and not a list of proposals sorted by something else.
  const keys = [...Object.keys(standing), ...[...touched.keys()].filter((k) => !(k in standing))];

  return keys.map((key) => {
    const hit = touched.get(key);
    return {
      key,
      current: standing[key] ?? null,
      change: hit?.change ?? null,
      proposed: hit?.proposed ?? null,
    };
  });
}

/** The changes that are not an attribute edit: a deletion, a merge, a new link. */
export const wholeRowChanges = (subject: Subject): readonly Change[] =>
  subject.changes.filter((c) => c.changes.length === 0);

const KIND_ORDER: Readonly<Record<SubjectKind, number>> = {
  'new-node': 0,
  link: 1,
  node: 2,
  merge: 3,
};

export function sortSubjects(subjects: readonly Subject[], key: SortKey): readonly Subject[] {
  const sorted = [...subjects];
  switch (key) {
    case 'confidence':
      return sorted.sort((a, b) => subjectConfidence(a) - subjectConfidence(b));
    case 'age':
      return sorted.sort(
        (a, b) =>
          Math.max(...b.changes.map((c) => c.ageDays)) -
          Math.max(...a.changes.map((c) => c.ageDays)),
      );
    case 'kind':
      return sorted.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
    case 'label':
      return sorted.sort((a, b) => a.label.localeCompare(b.label));
  }
}

/** The record of what was set aside, for the page that is rarely opened. */
export interface DecidedRow {
  readonly proposal: Proposal;
  readonly kind: ChangeKind;
  readonly label: string;
  readonly authorLabel: string;
}

export function decidedRows(): readonly DecidedRow[] {
  return proposals
    .filter((p) => p.status !== 'pending')
    .map((proposal) => {
      const change = toChange(proposal);
      const payload = proposal.payload;
      return {
        proposal,
        kind: change.kind,
        label:
          payload.kind === 'entity'
            ? payload.label
            : proposal.targetId !== null
              ? entityLabel(proposal.targetId)
              : change.summary,
        authorLabel: change.authorLabel,
      };
    });
}
