/** Provisional shapes. The generated contract does not exist yet, and these guesses stand in. */
export type DocId = string;

export type AttributeValue = string | number | boolean | readonly string[] | readonly number[];

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
  readonly uri: string | null;
  readonly archiveUri: string | null;
  readonly sha256: string | null;
  readonly retrievedAt: string | null;
  /** An ADMIRALTY rating, `A1` to `F6`. */
  readonly admiralty: string | null;
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
  /** A guess: how this column proves that every cited source exists is not decided yet. */
  readonly sources: readonly DocId[];
  readonly geom: Point | null;
  readonly promotedFrom: string;
}

/** A guess: a relation may point at another relation. Nothing supports or prevents it yet. */
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

/** A guess: the payload shape per operation is not decided yet. */
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
  readonly src: readonly DocId[];
  readonly confidence: number;
  readonly dissent: boolean;
  readonly authorRole: AuthorRole;
  readonly status: ProposalStatus;
  readonly callId: string;
  readonly createdAt: string;
  readonly decidedAt: string | null;
  readonly decidedBy: string | null;
}

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
  /** A guess: whether a reader ever sees the sent text is not decided yet. */
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
