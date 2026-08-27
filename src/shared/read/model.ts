// The shapes of the record, in domain words. Every surface reads these and never a wire row.

import { ATTRIBUTE_KIND } from '@gab/proposal/vocabulary';

export type DocId = string;

export type AttributeValue = string | number | boolean | readonly string[] | readonly number[];

/** M8: a value, and the documents that hold it up. */
export interface Attribute {
  readonly v: AttributeValue;
  readonly src: readonly DocId[];
}

export type Attributes = Readonly<Record<string, Attribute>>;

/** The seven kinds a key is declared with. The database holds the same seven in a check. */
export type AttributeKind = (typeof ATTRIBUTE_KIND)[keyof typeof ATTRIBUTE_KIND];

/** What `attribute_key` states about one key. A surface takes the control from `kind`, and it
 * never reads a type out of the shape of a value. */
export interface AttributeDeclaration {
  readonly key: string;
  readonly kind: AttributeKind;
  readonly label: string;
  /** The printable symbol of the unit of record, where the key carries one. */
  readonly unit: string | null;
  /** A regular expression the value must satisfy, written by the seed. */
  readonly pattern: string | null;
  /** A retired key keeps its history and takes no new value. */
  readonly retired: boolean;
}

/** Every key the database declares. It is read beside the corpus, and never written by hand. */
export type Vocabulary = readonly AttributeDeclaration[];

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

/** A point, in WGS 84. The column holds any geometry; a surface that draws a dot needs a point. */
export interface Point {
  readonly lon: number;
  readonly lat: number;
}

export interface Entity {
  readonly id: string;
  readonly type: string;
  /** The extracted word, kept when it was not a live type. The row then stands as `unknown`. */
  readonly proposedType: string | null;
  readonly label: string;
  readonly attrs: Attributes;
  /** S2 at row level: the list on the thing, and not on one value. */
  readonly sources: readonly DocId[];
  /** A geometry that is not a point reaches no surface, so it arrives here as `null`. */
  readonly geom: Point | null;
  readonly promotedFrom: string;
}

/** M4: a relation may point at a relation. Nothing writes that today and nothing prevents it. */
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

/** The act carries no kind of its own, so the operation states it. The keys inside keep the
 * spelling the act wrote, because the shape of a payload is an open question. */
export type ProposalPayload =
  | {
      readonly kind: 'entity';
      readonly type: string | null;
      readonly label: string | null;
      readonly attrs: Attributes;
    }
  | { readonly kind: 'attrs'; readonly attrs: Attributes }
  | {
      readonly kind: 'relation';
      readonly type: string | null;
      readonly src_id: string | null;
      readonly dst_id: string | null;
    }
  | {
      readonly kind: 'merge';
      readonly keep_id: string | null;
      readonly merge_ids: readonly string[];
    }
  | { readonly kind: 'delete'; readonly reason: string | null };

/** What the act replaced. An update copies the keys it named, because the live row still holds
 * every other one. A deletion copies the whole row it destroyed, and that row is not attributes. */
export type PriorValue =
  | { readonly kind: 'attrs'; readonly attrs: Attributes }
  | { readonly kind: 'row'; readonly row: Readonly<Record<string, unknown>> };

export type ProposalStatus = 'pending' | 'accepted' | 'rejected';

/** A trigger stamps this from `session_user`. The caller cannot state it. */
export type AuthorRole = 'gabriel_agent' | 'gabriel_app';

export interface Proposal {
  readonly id: string;
  readonly op: ProposalOp;
  readonly targetKind: EndpointKind | null;
  readonly targetId: string | null;
  readonly payload: ProposalPayload;
  readonly src: readonly DocId[];
  /** The other elements the act touches: the two ends of a relation, the entities a merge
   * absorbs. It is the way to find an act that names an element the payload does not carry. */
  readonly names: readonly string[];
  /** What the act replaced, so a surface draws a before beside an after. A creation and a merge
   * replace nothing, and an act that stated no snapshot carries `null`. */
  readonly priorValue: PriorValue | null;
  /** An act may state no confidence at all, and an absence is never a low score. */
  readonly confidence: number | null;
  readonly dissent: boolean;
  readonly authorRole: AuthorRole;
  readonly status: ProposalStatus;
  readonly createdAt: string;
  readonly decidedAt: string | null;
  readonly decidedBy: string | null;
}

export interface Corpus {
  readonly documents: readonly DocumentRow[];
  readonly entities: readonly Entity[];
  readonly relations: readonly Relation[];
  readonly proposals: readonly Proposal[];
}
