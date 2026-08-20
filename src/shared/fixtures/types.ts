/**
 * Provisional shapes for the prototypes. **This is not the contract.**
 *
 * `src/contract/` is generated from the `api` schema, and it does not exist because no table
 * exists. Until it does, the four feature prototypes need one shape to
 * agree on, and this file is it. It is a guess, written by hand, and it is deleted the day the
 * generated contract arrives.
 *
 * Two rules hold while it lives:
 *
 * - **Nothing here settles an open question.** Every guess below says what it guesses and what
 *   would prove it wrong, and the tracker carries the question. A prototype that finds a guess
 *   wrong reports it. It does not correct the guess and move on.
 * - **Nothing here is imported by anything but a prototype.** A generated type replaces it.
 */

/**
 * A document identifier. The database gives this a domain that refuses a NULL, a blank and an
 * empty string. `manual` is a real document row (M8), so the format rule permits it and only a
 * machine proposal refuses it.
 */
export type DocId = string;

/** M7: an attribute value is a scalar or a flat list. It is never an object and never null. */
export type AttributeValue = string | number | boolean | readonly string[] | readonly number[];

/** M8: every attribute carries at least one source. M9: the unknown is the absence of a key. */
export interface Attribute {
  readonly v: AttributeValue;
  readonly src: readonly DocId[];
}

export type Attributes = Readonly<Record<string, Attribute>>;

export type DocumentKind = 'file' | 'url' | 'api' | 'report' | 'manual';
export type AdmiraltyOrigin = 'machine' | 'arbitrated' | 'human';

export interface DocumentRow {
  readonly id: DocId;
  readonly kind: DocumentKind;
  readonly title: string;
  /** The original address. The bucket stays private, so this is what a reader is given. */
  readonly uri: string | null;
  /** A web archive copy of `uri`, recorded at ingest. */
  readonly archiveUri: string | null;
  readonly sha256: string | null;
  readonly retrievedAt: string | null;
  /** S4: an ADMIRALTY rating, `A1` to `F6`. */
  readonly admiralty: string | null;
  /** Invariant 6: a rating always carries its origin. */
  readonly admiraltyOrigin: AdmiraltyOrigin | null;
}

/** A point, in WGS 84. The database column is PostGIS `geometry`; a prototype needs no more. */
export interface Point {
  readonly lon: number;
  readonly lat: number;
}

export interface Entity {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly attrs: Attributes;
  /**
   * S2, entity level. Invariant 2 asks that every cited source exists in the documents, and the
   * tier that proves existence for this column is open.
   */
  readonly sources: readonly DocId[];
  readonly geom: Point | null;
  /** One door in. Every evidentiary row names the proposal that made it. */
  readonly promotedFrom: string;
}

/** M4: a relation may point at another relation. Nothing supports it and nothing prevents it. */
export type EndpointKind = 'entity' | 'relation';

export interface Relation {
  readonly id: string;
  readonly type: string;
  readonly srcKind: EndpointKind;
  readonly srcId: string;
  readonly dstKind: EndpointKind;
  readonly dstId: string;
  readonly attrs: Attributes;
  readonly sources: readonly DocId[];
  /** M6: an interval is reserved for identity and ownership relations. */
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly promotedFrom: string;
}

export type ProposalOp =
  | 'create_entity'
  | 'update_attrs'
  | 'delete_entity'
  | 'create_relation'
  | 'update_relation'
  | 'delete_relation'
  | 'merge_entities';

/**
 * **A guess, and the question is open.** The payload shape per operation is undecided, and this
 * union exists so that a prototype can draw a review card. The tracker carries the question, and
 * a prototype that finds this shape wrong reports it.
 */
export type ProposalPayload =
  | {
      readonly kind: 'entity';
      readonly type: string;
      readonly label: string;
      readonly attrs: Attributes;
    }
  | { readonly kind: 'attrs'; readonly attrs: Attributes }
  | {
      readonly kind: 'relation';
      readonly type: string;
      readonly srcId: string;
      readonly dstId: string;
    }
  | { readonly kind: 'merge'; readonly keepId: string; readonly mergeIds: readonly string[] }
  | { readonly kind: 'delete'; readonly reason: string };

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'superseded';

/** A trigger stamps this from `session_user`. The caller cannot state it. */
export type AuthorRole = 'gabriel_agent' | 'gabriel_app';

export interface Proposal {
  readonly id: string;
  readonly op: ProposalOp;
  readonly targetKind: EndpointKind | null;
  readonly targetId: string | null;
  readonly payload: ProposalPayload;
  /** Invariant 3: a machine proposal never cites `manual`. */
  readonly src: readonly DocId[];
  readonly confidence: number;
  readonly dissent: boolean;
  readonly authorRole: AuthorRole;
  readonly status: ProposalStatus;
  /** One row names the run, the agent and the text that was sent. */
  readonly callId: string;
  readonly createdAt: string;
  readonly decidedAt: string | null;
  readonly decidedBy: string | null;
}

/** Configuration. Append-only, owner-written, never written by an agent. */
export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly role: string;
  readonly model: string;
  readonly prompt: string;
  readonly createdAt: string;
}

export interface AgentCall {
  readonly id: string;
  readonly runId: string;
  readonly agentId: string;
  readonly ord: number;
  /** Exactly what was sent. Whether a reader ever sees it is open, and the tracker carries it. */
  readonly renderedPrompt: string;
  readonly createdAt: string;
}

export interface Corpus {
  readonly documents: readonly DocumentRow[];
  readonly entities: readonly Entity[];
  readonly relations: readonly Relation[];
  readonly proposals: readonly Proposal[];
  readonly agents: readonly Agent[];
  readonly agentCalls: readonly AgentCall[];
}
