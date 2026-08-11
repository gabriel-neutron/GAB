/**
 * **PROTOTYPE — throwaway.** It answers one question: is the W5–W6 review of `prd.md` §3
 * painful? It is not the review feature, and no line of it is written to survive.
 *
 * It reads `@/shared/fixtures/corpus`, which is synthetic, and it writes nothing. Every
 * decision an operator makes on the screen lives in React state and dies on reload. That is
 * deliberate: `spec.md` §5 puts the promotion inside a database function, and a prototype that
 * pretended to promote would be lying about the one thing that matters.
 *
 * **It settles no open question.** Where the data or the documents leave a hole, the screen
 * shows the hole and names the ticket. See the report at the end of the session.
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

/**
 * The clock, frozen. The fixture carries fixed dates, so a real clock would make the ages on
 * the screen drift and two runs of the prototype would not compare. This is the date in the
 * session context, not a decision.
 */
const NOW_MS = Date.parse('2026-08-11T00:00:00Z');

/**
 * **A number this prototype draws with. It decides nothing.**
 *
 * `spec.md` §5 says the threshold is an operational parameter and never a code constant, and §6
 * leaves the value open — #9. The operator removed the control from the review screen on
 * 11 August 2026: a rail beside a map has no room for it, and a review surface is not where an
 * operational parameter is set. **That removes the control, not the question.** The value below
 * is a placeholder so that a prototype can draw a queue, the real one is set outside the source,
 * and this line is deleted with the rest of the prototype. #9 stays open.
 */
const THRESHOLD = 0.5;

/** Why a proposal is in front of the analyst — the S3 rule. */
export type ReviewReason = 'dissent' | 'below-threshold' | 'both' | 'not-routed';

/** The group a row sits in. `unrouted` is the #42 gap, and it is a group of its own. */
export type Bucket = 'dissent' | 'below' | 'unrouted' | 'decided';

/**
 * What the proposal would do to the graph. The operation matters more than any other fact on
 * the card: a new node, a new link, an edit and a deletion are four different risks, and the
 * raw `op` string of the model does not say which is which at a glance.
 */
export type ChangeKind = 'new-node' | 'new-link' | 'edit' | 'delete' | 'merge';

/** A verdict the analyst reaches on the screen. It reaches no database. */
export type LocalVerdict = 'accepted' | 'rejected' | 'deferred';

export interface LocalDecision {
  readonly verdict: LocalVerdict;
  /** Written for a deferral, empty for the other two. */
  readonly reason: string;
}

export type DecisionMap = Readonly<Record<string, LocalDecision>>;

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

/** One line of the difference between the target as it stands and the proposal. */
export interface AttrChange {
  readonly key: string;
  readonly before: Attribute | null;
  readonly after: Attribute;
}

/** What the proposal would change, resolved against the evidentiary layer as it stands today. */
export interface TargetView {
  /** A short statement of the operation, in the words of the domain. */
  readonly headline: string;
  /** The evidentiary row the proposal points at, when it points at one. */
  readonly entity: Entity | null;
  readonly relation: Relation | null;
  /** Filled for an attribute change. Empty otherwise. */
  readonly changes: readonly AttrChange[];
  /** What the screen cannot show, and why. Each line names the ticket it belongs to. */
  readonly gaps: readonly string[];
}

export interface ReviewRow {
  readonly proposal: Proposal;
  readonly reason: ReviewReason;
  readonly bucket: Bucket;
  readonly kind: ChangeKind;
  /** The label an analyst reads in a list, never an identifier. */
  readonly title: string;
  readonly sources: readonly ResolvedSource[];
  readonly spans: readonly CitedSpan[];
  /** `extractor v4`, or null when the call names no agent. */
  readonly agentLabel: string | null;
  readonly ageDays: number;
  readonly target: TargetView;
}

const documentById = (id: DocId): DocumentRow | null =>
  corpus.documents.find((d) => d.id === id) ?? null;

const entityById = (id: string): Entity | null => corpus.entities.find((e) => e.id === id) ?? null;

const relationById = (id: string): Relation | null =>
  corpus.relations.find((r) => r.id === id) ?? null;

const entityLabel = (id: string): string => entityById(id)?.label ?? `unknown entity ${short(id)}`;

/** An identifier is never read aloud in full. Eight characters is enough to tell two apart. */
export const short = (id: string): string => id.slice(0, 8);

export function reasonFor(proposal: Proposal): ReviewReason {
  const low = proposal.confidence < THRESHOLD;
  if (proposal.dissent && low) return 'both';
  if (proposal.dissent) return 'dissent';
  if (low) return 'below-threshold';
  return 'not-routed';
}

/** True when the confidence sits under the threshold in force. No screen prints the number. */
export const isLowConfidence = (proposal: Proposal): boolean => proposal.confidence < THRESHOLD;

/** Where the threshold sits on a bar drawn from 0 to 1. The screen draws it; it never says it. */
export const THRESHOLD_MARK = THRESHOLD;

export function changeKindOf(op: ProposalOp): ChangeKind {
  switch (op) {
    case 'create_entity':
      return 'new-node';
    case 'create_relation':
      return 'new-link';
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
  'new-node': 'New node',
  'new-link': 'New link',
  edit: 'Edit',
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
 * That is not a citation. It is a string that a prompt template made, and a change to the
 * template silently empties every card. The finding belongs to #44 and #45.
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

function targetOf(proposal: Proposal): TargetView {
  const gaps: string[] = [];
  const entity =
    proposal.targetKind === 'entity' && proposal.targetId !== null
      ? entityById(proposal.targetId)
      : null;
  const relation =
    proposal.targetKind === 'relation' && proposal.targetId !== null
      ? relationById(proposal.targetId)
      : null;

  const payload = proposal.payload;
  switch (payload.kind) {
    case 'attrs': {
      if (entity === null && relation === null) {
        gaps.push('The target is in no evidentiary row.');
      }
      return {
        headline: entity?.label ?? relation?.type ?? 'an unknown row',
        entity,
        relation,
        changes: attrChanges(entity?.attrs ?? relation?.attrs ?? null, payload.attrs),
        gaps,
      };
    }
    case 'entity': {
      // A create has no target, so the useful reading is whether the label is already taken.
      const twin = corpus.entities.find(
        (e) => e.label.toLowerCase() === payload.label.toLowerCase(),
      );
      if (twin !== undefined) {
        gaps.push(
          'A row with this exact label already stands. The payload cannot say whether it is the same object — #7.',
        );
      }
      return {
        headline: `${payload.label} · ${payload.type}`,
        entity: twin ?? null,
        relation: null,
        changes: attrChanges(null, payload.attrs),
        gaps,
      };
    }
    case 'relation': {
      gaps.push(
        'The relation payload carries no sources. Nothing says whether the promoted link inherits the proposal’s — #7.',
      );
      return {
        headline: `${entityLabel(payload.srcId)} —${payload.type}→ ${entityLabel(payload.dstId)}`,
        entity: null,
        relation: null,
        changes: [],
        gaps,
      };
    }
    case 'merge': {
      const kept = entityById(payload.keepId);
      return {
        headline: `${payload.mergeIds.map(entityLabel).join(', ')} → ${kept?.label ?? short(payload.keepId)}`,
        entity: kept,
        relation: null,
        changes: [],
        gaps: [
          'The payload names the rows, never the result. The merged object cannot be shown — #7.',
        ],
      };
    }
    case 'delete': {
      return { headline: payload.reason, entity, relation, changes: [], gaps };
    }
  }
}

/** A title an analyst can read in a narrow rail. The payload holds it; the proposal does not. */
function titleOf(proposal: Proposal): string {
  const payload = proposal.payload;
  switch (payload.kind) {
    case 'entity':
      return payload.label;
    case 'attrs': {
      const target =
        proposal.targetId === null
          ? 'an unnamed row'
          : (entityById(proposal.targetId)?.label ?? short(proposal.targetId));
      return `${target} · ${Object.keys(payload.attrs).join(', ')}`;
    }
    case 'relation':
      return `${entityLabel(payload.srcId)} → ${entityLabel(payload.dstId)}`;
    case 'merge':
      return entityById(payload.keepId)?.label ?? short(payload.keepId);
    case 'delete':
      return payload.reason;
  }
}

function toRow(proposal: Proposal): ReviewRow {
  const reason = reasonFor(proposal);
  const call = corpus.agentCalls.find((c) => c.id === proposal.callId) ?? null;
  const agent = call === null ? undefined : corpus.agents.find((a) => a.id === call.agentId);

  const bucket: Bucket =
    proposal.status !== 'pending'
      ? 'decided'
      : reason === 'not-routed'
        ? 'unrouted'
        : reason === 'below-threshold'
          ? 'below'
          : 'dissent';

  return {
    proposal,
    reason,
    bucket,
    kind: changeKindOf(proposal.op),
    title: titleOf(proposal),
    sources: proposal.src.map((id) => ({ id, doc: documentById(id) })),
    spans: citedSpans(call?.renderedPrompt ?? null),
    agentLabel: agent === undefined ? null : `${agent.name} v${agent.version}`,
    ageDays: Math.max(0, Math.round((NOW_MS - Date.parse(proposal.createdAt)) / 86_400_000)),
    target: targetOf(proposal),
  };
}

/**
 * The review surface holds what waits for a decision, and nothing else. A decided proposal is
 * never deleted — `spec.md` §5 — but it is the record and not the work, so it lives on its own
 * page and is not carried through the queue every day.
 */
export function pendingRows(): readonly ReviewRow[] {
  return corpus.proposals.filter((p) => p.status === 'pending').map(toRow);
}

/** The record of what was set aside, for the page that is rarely opened. */
export function decidedRows(): readonly ReviewRow[] {
  return corpus.proposals.filter((p) => p.status !== 'pending').map(toRow);
}

export const BUCKET_TITLE: Readonly<Record<Bucket, string>> = {
  dissent: 'Dissent',
  below: 'Low confidence',
  unrouted: 'Not routed',
  decided: 'Decided',
};

/** The order the buckets are read in. `unrouted` sits below the two S3 routes, never among them. */
export const BUCKET_ORDER: readonly Bucket[] = ['dissent', 'below', 'unrouted'];

export function groupRows(
  rows: readonly ReviewRow[],
): readonly (readonly [Bucket, readonly ReviewRow[]])[] {
  return BUCKET_ORDER.map(
    (bucket) => [bucket, rows.filter((r) => r.bucket === bucket)] as const,
  ).filter(([, list]) => list.length > 0);
}
