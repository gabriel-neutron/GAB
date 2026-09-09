// The generated contract states every column nullable, because a view proves no more. Each
// schema narrows what the base table declares NOT NULL and the closed sets its checks allow,
// and it names the column, so a broken read says which one broke.

import { z } from 'zod';

import { document as apiDocument } from '@/contract/api/Document';
import { entity as apiEntity } from '@/contract/api/Entity';
import { entityType as apiEntityType } from '@/contract/api/EntityType';
import { fullMap as apiFullMap } from '@/contract/api/FullMap';
import { layout as apiLayout } from '@/contract/api/Layout';
import { proposal as apiProposal } from '@/contract/api/Proposal';
import { relation as apiRelation } from '@/contract/api/Relation';

import { CLOSED_SET } from './closed-set';

const stated = (column: string): { error: string } => ({
  error: `the column ${column} does not carry a value the base table permits`,
});

const text = (column: string): z.ZodString => z.string(stated(column));

const docIds = (column: string): z.ZodArray<z.ZodString> => z.array(z.string(), stated(column));

export const wireRow = {
  entityType: apiEntityType.and(
    z.object({
      key: text('entity_type.key'),
      label: text('entity_type.label'),
      colour_light: text('entity_type.colour_light'),
      colour_dark: text('entity_type.colour_dark'),
      ord: z.number(stated('entity_type.ord')),
      retired: z.boolean(stated('entity_type.retired')),
    }),
  ),

  document: apiDocument.and(
    z.object({
      id: text('document.id'),
      kind: z.enum(CLOSED_SET['documents.kind'], stated('document.kind')),
      title: text('document.title'),
      admiralty_origin: z
        .enum(CLOSED_SET['documents.admiralty_origin'], stated('document.admiralty_origin'))
        .nullable(),
    }),
  ),

  entity: apiEntity.and(
    z.object({
      id: text('entity.id'),
      type: text('entity.type'),
      label: text('entity.label'),
      sources: docIds('entity.sources'),
      promoted_from: text('entity.promoted_from'),
    }),
  ),

  relation: apiRelation.and(
    z.object({
      id: text('relation.id'),
      type: text('relation.type'),
      src_kind: z.enum(CLOSED_SET['relations.src_kind'], stated('relation.src_kind')),
      src_id: text('relation.src_id'),
      dst_kind: z.enum(CLOSED_SET['relations.dst_kind'], stated('relation.dst_kind')),
      dst_id: text('relation.dst_id'),
      sources: docIds('relation.sources'),
      promoted_from: text('relation.promoted_from'),
    }),
  ),

  // `geom`, the word and the parent are each a real absence: an entity nobody placed, an entity
  // the analyst said nothing about, an entity at its own point. So only the two columns the base
  // table declares NOT NULL narrow here, and the generated nullable stands for the other three.
  fullMap: apiFullMap.and(
    z.object({
      id: text('full_map.id'),
      type: text('full_map.type'),
    }),
  ),

  // x and y stand or fall together: the view reads them from one row, so a position with one
  // half is a row the base table cannot hold.
  layout: apiLayout.and(
    z.object({
      entity_id: text('layout.entity_id'),
      x: z.number(stated('entity_layout.x')).nullable(),
      y: z.number(stated('entity_layout.y')).nullable(),
    }),
  ),

  proposal: apiProposal.and(
    z.object({
      id: text('proposal.id'),
      op: z.enum(CLOSED_SET['proposals.op'], stated('proposal.op')),
      target_kind: z
        .enum(CLOSED_SET['proposals.target_kind'], stated('proposal.target_kind'))
        .nullable(),
      src: docIds('proposal.src'),
      dissent: z.boolean(stated('proposal.dissent')),
      author_role: z.enum(CLOSED_SET['proposals.author_role'], stated('proposal.author_role')),
      status: z.enum(CLOSED_SET['proposals.status'], stated('proposal.status')),
      created_at: text('proposal.created_at'),
    }),
  ),
} as const;
