// A wire row becomes a record row here, and only here. This is the one file where a column of
// the database stands beside a word of the domain.

import { z } from 'zod';

import { interiorPointOf } from './interior-point';
import type {
  Area,
  Attributes,
  DocumentRow,
  Entity,
  EntityPlacement,
  EntityTypeDeclaration,
  RelationTypeDeclaration,
  MapPosition,
  Point,
  PriorValue,
  Proposal,
  ProposalOp,
  ProposalPayload,
  ProposedGeometry,
  Relation,
  Ring,
} from './model';
import { row as rowOf } from './rows';

const attribute = z.strictObject({
  v: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.array(z.number())]),
  src: z.array(z.string()).min(1),
});

// The shape the database checks on every attribute object: one value and its documents per key.
const attributeObject = z.record(z.string(), attribute);

const attributesOf = (value: unknown): Attributes =>
  value === undefined || value === null ? {} : attributeObject.parse(value);

// A geometry column holds a point, a line or a polygon. The map draws a point and an area, so it
// keeps those two and reads a line as no position at all.
const geoPoint = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()], z.number()),
});

// A position may carry an altitude, and the map draws none of it.
const pairs = (positions: readonly (readonly number[])[]): Ring =>
  positions.map(([lon, lat]) => [lon ?? 0, lat ?? 0]);

function pointOf(value: unknown): Point | null {
  const held = geoPoint.safeParse(value);
  if (!held.success) return null;
  return { lon: held.data.coordinates[0], lat: held.data.coordinates[1] };
}

const position = z.tuple([z.number(), z.number()], z.number());
const ring = z.array(position).min(4);
const geoPolygon = z.object({ type: z.literal('Polygon'), coordinates: z.array(ring).min(1) });
const geoMultiPolygon = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(z.array(ring).min(1)).min(1),
});

function areaOf(value: unknown): Area | null {
  const polygon = geoPolygon.safeParse(value);
  if (polygon.success) return [polygon.data.coordinates.map(pairs)];
  const many = geoMultiPolygon.safeParse(value);
  return many.success ? many.data.coordinates.map((rings) => rings.map(pairs)) : null;
}

// The act carries no kind of its own, so the operation states which payload it wrote.
// `update_relation` writes an attribute object and never two ends: the promotion reads
// `payload->'attrs'` for it, in the branch of `update_attrs`, and the check on a snapshot agrees.
const KIND_OF_OP: Readonly<Record<ProposalOp, ProposalPayload['kind']>> = {
  create_entity: 'entity',
  update_attrs: 'attrs',
  update_entity: 'columns',
  delete_entity: 'delete',
  create_relation: 'relation',
  update_relation: 'attrs',
  delete_relation: 'delete',
  merge_entities: 'merge',
};

const geometryType = z.looseObject({ type: z.string() });

function proposedGeometryOf(value: unknown): ProposedGeometry | null {
  if (value === undefined || value === null) return null;
  const point = pointOf(value);
  if (point !== null) return { kind: 'point', point };
  return { kind: 'shape', shape: geometryType.parse(value).type };
}

const endpointKind = z.enum(['entity', 'relation']);

// The record refuses a new entity with no type or no name, and a new relation with no type or
// no end, so neither payload reads a fallback for one.
const entityPayload = z.looseObject({
  type: z.string(),
  label: z.string(),
  geom: z.unknown().optional(),
  attrs: z.unknown().optional(),
});
const attrsPayload = z.looseObject({ attrs: z.unknown().optional() });
const columnsPayload = z.looseObject({
  label: z.string().nullish(),
  type: z.string().nullish(),
});
const relationPayload = z.looseObject({
  type: z.string(),
  src_kind: endpointKind.nullish(),
  src_id: z.string(),
  dst_kind: endpointKind.nullish(),
  dst_id: z.string(),
  valid_from: z.string().nullish(),
  valid_to: z.string().nullish(),
  attrs: z.unknown().optional(),
});
const mergePayload = z.looseObject({
  keep_id: z.string().nullish(),
  merge_ids: z.array(z.string()).nullish(),
});
const deletePayload = z.looseObject({ reason: z.string().nullish() });

function payloadOf(op: ProposalOp, value: unknown): ProposalPayload {
  const kind = KIND_OF_OP[op];
  switch (kind) {
    case 'entity': {
      const held = entityPayload.parse(value);
      return {
        kind,
        type: held.type,
        label: held.label,
        geom: proposedGeometryOf(held.geom),
        attrs: attributesOf(held.attrs),
      };
    }
    case 'attrs': {
      const held = attrsPayload.parse(value);
      return { kind, attrs: attributesOf(held.attrs) };
    }
    case 'columns': {
      const held = columnsPayload.parse(value);
      return { kind, label: held.label ?? null, type: held.type ?? null };
    }
    case 'relation': {
      const held = relationPayload.parse(value);
      // External constraint: the promotion stores an end that states no kind as an entity.
      return {
        kind,
        type: held.type,
        src_kind: held.src_kind ?? 'entity',
        src_id: held.src_id,
        dst_kind: held.dst_kind ?? 'entity',
        dst_id: held.dst_id,
        valid_from: held.valid_from ?? null,
        valid_to: held.valid_to ?? null,
        attrs: attributesOf(held.attrs),
      };
    }
    case 'merge': {
      const held = mergePayload.parse(value);
      return { kind, keep_id: held.keep_id ?? null, merge_ids: held.merge_ids ?? [] };
    }
    case 'delete': {
      const held = deletePayload.parse(value);
      return { kind, reason: held.reason ?? null };
    }
  }
}

// The whole row a deletion destroyed, or the columns an act on the name or the type replaced.
// Neither is an attribute object, so this reads the keys and states no shape for them.
const priorRow = z.record(z.string(), z.unknown());

// A snapshot stands on an update and on a delete, and on no other act: the check on the column
// permits it there alone.
function priorValueOf(op: ProposalOp, value: unknown): PriorValue | null {
  if (value === undefined || value === null) return null;
  switch (op) {
    case 'update_attrs':
    case 'update_relation':
      return { kind: 'attrs', attrs: attributeObject.parse(value) };
    case 'update_entity':
    case 'delete_entity':
    case 'delete_relation':
      return { kind: 'row', row: priorRow.parse(value) };
    case 'create_entity':
    case 'create_relation':
    case 'merge_entities':
      return null;
  }
}

function entityType(row: unknown): EntityTypeDeclaration {
  const read = rowOf.entityType.parse(row);
  return {
    key: read.key,
    label: read.label,
    colourLight: read.colour_light,
    colourDark: read.colour_dark,
    retired: read.retired,
  };
}

function relationType(row: unknown): RelationTypeDeclaration {
  const read = rowOf.relationType.parse(row);
  return {
    key: read.key,
    label: read.label,
    inverseLabel: read.inverse_label,
    takesInterval: read.takes_interval,
    retired: read.retired,
  };
}

const WEB_SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:']);

// Departure: a surface puts a document address into a link. Any other scheme, or an address
// that does not parse, arrives as no address, so no surface links a file or an OS handler.
function webAddressOf(value: string | null): string | null {
  if (value === null) return null;
  const parsed = URL.parse(value);
  return parsed !== null && WEB_SCHEMES.has(parsed.protocol) ? value : null;
}

function document(row: unknown): DocumentRow {
  const read = rowOf.document.parse(row);
  return {
    id: read.id,
    kind: read.kind,
    title: read.title,
    uri: webAddressOf(read.uri),
    archiveUri: webAddressOf(read.archive_uri),
    sha256: read.sha256,
    retrievedAt: read.retrieved_at,
    admiralty: read.admiralty,
    admiraltyOrigin: read.admiralty_origin,
  };
}

function entity(row: unknown): Entity {
  const read = rowOf.entity.parse(row);
  return {
    id: read.id,
    type: read.type,
    proposedType: read.proposed_type,
    label: read.label,
    attrs: attributesOf(read.attrs),
    sources: read.sources,
    geom: pointOf(read.geom),
    promotedFrom: read.promoted_from,
  };
}

function relation(row: unknown): Relation {
  const read = rowOf.relation.parse(row);
  return {
    id: read.id,
    type: read.type,
    proposedType: read.proposed_type,
    srcKind: read.src_kind,
    srcId: read.src_id,
    dstKind: read.dst_kind,
    dstId: read.dst_id,
    attrs: attributesOf(read.attrs),
    sources: read.sources,
    validFrom: read.valid_from,
    validTo: read.valid_to,
    promotedFrom: read.promoted_from,
  };
}

function proposal(row: unknown): Proposal {
  const read = rowOf.proposal.parse(row);
  return {
    id: read.id,
    op: read.op,
    targetKind: read.target_kind,
    targetId: read.target_id,
    payload: payloadOf(read.op, read.payload),
    src: read.src,
    names: read.names,
    priorValue: priorValueOf(read.op, read.prior_value),
    confidence: read.confidence,
    dissent: read.dissent,
    authorRole: read.author_role,
    status: read.status,
    createdAt: read.created_at,
    decidedAt: read.decided_at,
    decidedBy: read.decided_by,
    batchId: read.batch_id,
  };
}

// A run places an entity or it does not, so one half of a position is not a state the record
// can hold: a row that carries one of the two arrives here as no position at all.
function placement(row: unknown): EntityPlacement {
  const read = rowOf.layout.parse(row);
  const { x, y } = read;
  return {
    entityId: read.entity_id,
    position: x === null || y === null ? null : { x, y },
  };
}

// `api.full_map` already walked to the ancestor, so this function chooses nothing: it renames
// four columns. A default word here would invent a measured position for a row the analyst said
// nothing about, so `precision` passes through and it is never coalesced.
function mapPosition(row: unknown): MapPosition {
  const read = rowOf.fullMap.parse(row);
  const area = areaOf(read.geom);
  return {
    entityId: read.id,
    // An area has one mark, and it stands inside the area, so the rail, the selection and the
    // relations read a point as they do for every other entity.
    point: area === null ? pointOf(read.geom) : interiorPointOf(area),
    area,
    precision: read.position_precision,
    parentId: read.parent_id,
  };
}

/** Each one reads a row of the read API and gives the record row a surface works in. */
export const toDomain = {
  entityType,
  relationType,
  document,
  entity,
  relation,
  proposal,
  placement,
  mapPosition,
} as const;
