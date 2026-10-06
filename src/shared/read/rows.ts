// The row of each view of the read API, as the base table holds it. A view states every column
// nullable, because a view proves no more, so each row is stated here once: the columns the base
// table declares NOT NULL, and the closed sets its checks allow. A broken read names its column.

import { z } from 'zod';

const ENDPOINT = ['entity', 'relation'] as const;

const stated = (column: string): { error: string } => ({
  error: `the column ${column} does not carry a value the base table permits`,
});

const text = (column: string): z.ZodString => z.string(stated(column));

const nullableText = (column: string) => z.string(stated(column)).nullable();

const docIds = (column: string): z.ZodArray<z.ZodString> => z.array(z.string(), stated(column));

export const row = {
  entityType: z.object({
    key: text('entity_type.key'),
    label: text('entity_type.label'),
    colour_light: text('entity_type.colour_light'),
    colour_dark: text('entity_type.colour_dark'),
    ord: z.number(stated('entity_type.ord')),
    retired: z.boolean(stated('entity_type.retired')),
  }),

  relationType: z.object({
    key: text('relation_type.key'),
    label: text('relation_type.label'),
    inverse_label: text('relation_type.inverse_label'),
    takes_interval: z.boolean(stated('relation_type.takes_interval')),
    retired: z.boolean(stated('relation_type.retired')),
  }),

  document: z.object({
    id: text('document.id'),
    kind: z.enum(['file', 'url', 'api', 'report', 'manual'], stated('document.kind')),
    title: text('document.title'),
    uri: nullableText('document.uri'),
    archive_uri: nullableText('document.archive_uri'),
    sha256: nullableText('document.sha256'),
    retrieved_at: nullableText('document.retrieved_at'),
    admiralty: nullableText('document.admiralty'),
    admiralty_origin: z
      .enum(['machine', 'arbitrated', 'human'], stated('document.admiralty_origin'))
      .nullable(),
  }),

  entity: z.object({
    id: text('entity.id'),
    type: text('entity.type'),
    proposed_type: nullableText('entity.proposed_type'),
    label: text('entity.label'),
    geom: z.unknown(),
    attrs: z.unknown(),
    sources: docIds('entity.sources'),
    promoted_from: text('entity.promoted_from'),
  }),

  relation: z.object({
    id: text('relation.id'),
    type: text('relation.type'),
    proposed_type: nullableText('relation.proposed_type'),
    src_kind: z.enum(ENDPOINT, stated('relation.src_kind')),
    src_id: text('relation.src_id'),
    dst_kind: z.enum(ENDPOINT, stated('relation.dst_kind')),
    dst_id: text('relation.dst_id'),
    valid_from: nullableText('relation.valid_from'),
    valid_to: nullableText('relation.valid_to'),
    attrs: z.unknown(),
    sources: docIds('relation.sources'),
    promoted_from: text('relation.promoted_from'),
  }),

  // `geom`, the word and the parent are each a real absence: an entity nobody placed, an entity
  // the analyst said nothing about, an entity at its own point.
  fullMap: z.object({
    id: text('full_map.id'),
    type: text('full_map.type'),
    geom: z.unknown(),
    position_precision: nullableText('full_map.position_precision'),
    parent_id: nullableText('full_map.parent_id'),
  }),

  // x and y stand or fall together: the view reads them from one row.
  layout: z.object({
    entity_id: text('layout.entity_id'),
    x: z.number(stated('entity_layout.x')).nullable(),
    y: z.number(stated('entity_layout.y')).nullable(),
  }),

  proposal: z.object({
    id: text('proposal.id'),
    op: z.enum(
      [
        'create_entity',
        'update_attrs',
        'update_entity',
        'delete_entity',
        'create_relation',
        'update_relation',
        'delete_relation',
        'merge_entities',
      ],
      stated('proposal.op'),
    ),
    target_kind: z.enum(ENDPOINT, stated('proposal.target_kind')).nullable(),
    target_id: nullableText('proposal.target_id'),
    payload: z.unknown(),
    src: docIds('proposal.src'),
    names: docIds('proposal.names'),
    prior_value: z.unknown(),
    confidence: z.number(stated('proposal.confidence')).nullable(),
    dissent: z.boolean(stated('proposal.dissent')),
    author_role: z.enum(
      ['gabriel_agent', 'gabriel_app', 'gabriel_research'],
      stated('proposal.author_role'),
    ),
    status: z.enum(['pending', 'accepted', 'rejected'], stated('proposal.status')),
    created_at: text('proposal.created_at'),
    decided_at: nullableText('proposal.decided_at'),
    decided_by: nullableText('proposal.decided_by'),
  }),
} as const;
