// The shapes of the record, in domain words. Every surface reads these and never a wire row.

export type DocId = string;

export type AttributeValue = string | number | boolean | readonly string[] | readonly number[];

/** M7: one value and the documents that hold it up, in one shape. */
export interface Attribute {
  readonly v: AttributeValue;
  readonly src: readonly DocId[];
}

export type Attributes = Readonly<Record<string, Attribute>>;

/** What `entity_type` states about one type. A canvas takes the hue from here, and it never
 * takes one from a position in a list. */
export interface EntityTypeDeclaration {
  readonly key: string;
  readonly label: string;
  /** Two hues and not one: one hex value fails one of the two pages. A map takes the dark hue on
   * both themes, because its ground is imagery. */
  readonly colourLight: string;
  readonly colourDark: string;
  /** Out of service: the rows that carry the word keep it, and no new row takes it. */
  readonly retired: boolean;
}

/** Every entity type the database declares, retired ones included: a promoted row still carries
 * that word. It is read beside the corpus, and never written by hand. */
export type TypeVocabulary = readonly EntityTypeDeclaration[];

/** What `relation_type` states about one type. A relation is stored in one direction only, so a
 * page reads it from its source in `label` and from its far end in `inverseLabel`. */
export interface RelationTypeDeclaration {
  readonly key: string;
  readonly label: string;
  readonly inverseLabel: string;
  /** M6: whether a relation of this type may carry `validFrom` and `validTo`. */
  readonly takesInterval: boolean;
  /** Out of service: the rows that carry the word keep it, and no new row takes it. */
  readonly retired: boolean;
}

/** Every relation type the database declares, retired ones included: a promoted row still
 * carries that word. */
export type RelationTypeVocabulary = readonly RelationTypeDeclaration[];

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

/** A provider that distributes the bytes of a document, and the licence it gives them. */
export interface DocumentProvider {
  readonly id: string;
  readonly name: string;
  readonly licence: string;
}

/** A point, in WGS 84. The column holds any geometry; a surface that draws a dot needs a point. */
export interface Point {
  readonly lon: number;
  readonly lat: number;
}

/** Where the graph draws one entity. It is derived from the record, and no source holds it up. */
export interface EntityPosition {
  readonly x: number;
  readonly y: number;
}

/** One entity, and the position the last layout run gave it. A run that did not place it leaves
 * `position` null, and the surface then places that entity itself. */
export interface EntityPlacement {
  readonly entityId: string;
  readonly position: EntityPosition | null;
}

/** Where the map draws one entity: its own point, or the point of the nearest ancestor through
 * `subordinate_to` when it states `position_precision` as `inherited`. T4 puts that walk in SQL,
 * so no surface repeats it. */
export interface MapPosition {
  readonly entityId: string;
  /** Null for an entity nobody located and whose ancestors carry no point either. A row arrives
   * for EVERY entity, and not for the drawn ones alone. */
  readonly point: Point | null;
  /** The word the analyst wrote about the position: `exact`, `approximate` or `inherited`. It
   * may be ABSENT, and an absence is never a measured position. No surface may supply a default
   * word here: a row that states nothing must draw and read as the cautious state. */
  readonly precision: string | null;
  /** The ancestor the point was taken from. It is null when the entity stands at its own point,
   * so a surface never states an origin that the point never had. */
  readonly parentId: string | null;
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
  /** The extracted word, kept when it was not a live type. The row then stands as `unknown`. */
  readonly proposedType: string | null;
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
  | 'update_entity'
  | 'delete_entity'
  | 'create_relation'
  | 'update_relation'
  | 'delete_relation'
  | 'merge_entities';

/** Departure: a shape that is not a point keeps only its GeoJSON type, because a card prints no
 * positions of a line or an area. */
export type ProposedGeometry =
  | { readonly kind: 'point'; readonly point: Point }
  | { readonly kind: 'shape'; readonly shape: string };

/** The act carries no kind of its own, so the operation states it. The keys inside keep the
 * spelling the act wrote, because the shape of a payload is an open question. */
export type ProposalPayload =
  | {
      readonly kind: 'entity';
      readonly type: string;
      readonly label: string;
      readonly geom: ProposedGeometry | null;
      readonly attrs: Attributes;
    }
  | { readonly kind: 'attrs'; readonly attrs: Attributes }
  | { readonly kind: 'columns'; readonly label: string | null; readonly type: string | null }
  | {
      readonly kind: 'relation';
      readonly type: string;
      readonly src_kind: EndpointKind;
      readonly src_id: string;
      readonly dst_kind: EndpointKind;
      readonly dst_id: string;
      readonly valid_from: string | null;
      readonly valid_to: string | null;
      readonly attrs: Attributes;
    }
  | {
      readonly kind: 'merge';
      readonly keep_id: string | null;
      readonly merge_ids: readonly string[];
    }
  | { readonly kind: 'delete'; readonly reason: string | null };

/** What the act replaced. An update copies the keys it named, because the live row still holds
 * every other one. A deletion copies the whole row it destroyed, and an act on the name or the
 * type copies the columns it replaced. Neither of those two is attributes. */
export type PriorValue =
  | { readonly kind: 'attrs'; readonly attrs: Attributes }
  | { readonly kind: 'row'; readonly row: Readonly<Record<string, unknown>> };

export type ProposalStatus = 'pending' | 'accepted' | 'rejected';

/** A trigger stamps this from `session_user`. The caller cannot state it. */
export type AuthorRole = 'gabriel_agent' | 'gabriel_app' | 'gabriel_research';

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
  /** The linked batch of a machine act, which the operator decides as one unit. A single act
   * has none. */
  readonly batchId: string | null;
}

export interface Corpus {
  readonly documents: readonly DocumentRow[];
  readonly entities: readonly Entity[];
  readonly relations: readonly Relation[];
  readonly proposals: readonly Proposal[];
  /** One row per entity. The map reads this and never `Entity.geom`: the geometry column of an
   * entity says where it was located, and this says where the map draws it. The two differ for
   * the entity that inherits its point, and that difference is the whole reason this exists. */
  readonly positions: readonly MapPosition[];
  /** The words of each relation type. Every surface that words a relation reads the corpus, so
   * the list travels with it and no surface words a type from its key. */
  readonly relationTypes: RelationTypeVocabulary;
}
