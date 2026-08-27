// A wire row becomes a record row here, and only here. This is the one file where a column of
// the database stands beside a word of the domain.

import { z } from 'zod';

import type {
  AttributeDeclaration,
  Attributes,
  DocumentRow,
  Entity,
  EntityTypeDeclaration,
  Point,
  PriorValue,
  Proposal,
  ProposalOp,
  ProposalPayload,
  Relation,
} from './model';
import { wireRow } from './wire';

const attribute = z.strictObject({
  v: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.array(z.number())]),
  src: z.array(z.string()).min(1),
});

// The shape the database checks on every attribute object: one value and its documents per key.
const attributeObject = z.record(z.string(), attribute);

const attributesOf = (value: unknown): Attributes =>
  value === undefined || value === null ? {} : attributeObject.parse(value);

// A geometry column holds a point, a line or a polygon. A surface draws a dot, so it takes the
// point and reads everything else as no position at all.
const geoPoint = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()], z.number()),
});

function pointOf(value: unknown): Point | null {
  const held = geoPoint.safeParse(value);
  if (!held.success) return null;
  return { lon: held.data.coordinates[0], lat: held.data.coordinates[1] };
}

// The act carries no kind of its own, so the operation states which payload it wrote.
// `update_relation` writes an attribute object and never two ends: the promotion reads
// `payload->'attrs'` for it, in the branch of `update_attrs`, and the check on a snapshot agrees.
const KIND_OF_OP: Readonly<Record<ProposalOp, ProposalPayload['kind']>> = {
  create_entity: 'entity',
  update_attrs: 'attrs',
  delete_entity: 'delete',
  create_relation: 'relation',
  update_relation: 'attrs',
  delete_relation: 'delete',
  merge_entities: 'merge',
};

const entityPayload = z.looseObject({
  type: z.string().nullish(),
  label: z.string().nullish(),
  attrs: z.unknown().optional(),
});
const attrsPayload = z.looseObject({ attrs: z.unknown().optional() });
const relationPayload = z.looseObject({
  type: z.string().nullish(),
  src_id: z.string().nullish(),
  dst_id: z.string().nullish(),
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
        type: held.type ?? null,
        label: held.label ?? null,
        attrs: attributesOf(held.attrs),
      };
    }
    case 'attrs': {
      const held = attrsPayload.parse(value);
      return { kind, attrs: attributesOf(held.attrs) };
    }
    case 'relation': {
      const held = relationPayload.parse(value);
      return {
        kind,
        type: held.type ?? null,
        src_id: held.src_id ?? null,
        dst_id: held.dst_id ?? null,
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

// The whole row a deletion destroyed. It is any object the table held, and never an attribute
// object, so this reads the keys and states no shape for them.
const priorRow = z.record(z.string(), z.unknown());

// A snapshot stands on an update and on a delete, and on no other act: the check on the column
// permits it there alone.
function priorValueOf(op: ProposalOp, value: unknown): PriorValue | null {
  if (value === undefined || value === null) return null;
  switch (op) {
    case 'update_attrs':
    case 'update_relation':
      return { kind: 'attrs', attrs: attributeObject.parse(value) };
    case 'delete_entity':
    case 'delete_relation':
      return { kind: 'row', row: priorRow.parse(value) };
    case 'create_entity':
    case 'create_relation':
    case 'merge_entities':
      return null;
  }
}

function attributeKey(row: unknown): AttributeDeclaration {
  const read = wireRow.attributeKey.parse(row);
  return {
    key: read.key,
    kind: read.kind,
    label: read.label,
    unit: read.unit,
    pattern: read.pattern,
    retired: read.retired,
  };
}

function entityType(row: unknown): EntityTypeDeclaration {
  const read = wireRow.entityType.parse(row);
  return {
    key: read.key,
    label: read.label,
    colourLight: read.colour_light,
    colourDark: read.colour_dark,
    ord: read.ord,
    retired: read.retired,
  };
}

function document(row: unknown): DocumentRow {
  const read = wireRow.document.parse(row);
  return {
    id: read.id,
    kind: read.kind,
    title: read.title,
    uri: read.uri,
    archiveUri: read.archive_uri,
    sha256: read.sha256,
    retrievedAt: read.retrieved_at,
    admiralty: read.admiralty,
    admiraltyOrigin: read.admiralty_origin,
  };
}

function entity(row: unknown): Entity {
  const read = wireRow.entity.parse(row);
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
  const read = wireRow.relation.parse(row);
  return {
    id: read.id,
    type: read.type,
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
  const read = wireRow.proposal.parse(row);
  return {
    id: read.id,
    op: read.op,
    targetKind: read.target_kind,
    targetId: read.target_id,
    payload: payloadOf(read.op, read.payload),
    src: read.src,
    names: read.names ?? [],
    priorValue: priorValueOf(read.op, read.prior_value),
    confidence: read.confidence,
    dissent: read.dissent,
    authorRole: read.author_role,
    status: read.status,
    createdAt: read.created_at,
    decidedAt: read.decided_at,
    decidedBy: read.decided_by,
  };
}

/** Each one reads a row of the read API and gives the record row a surface works in. */
export const toDomain = {
  attributeKey,
  entityType,
  document,
  entity,
  relation,
  proposal,
} as const;
