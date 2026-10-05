import type { RelationTypeKey } from './RelationType';
import type { ProposalsId } from './Proposals';

/** Identifier type for public.relations */
export type RelationsId = string & { __brand: 'public.relations' };

export default interface Relations {
  id: RelationsId;

  type: RelationTypeKey;

  src_kind: string;

  src_id: string;

  dst_kind: string;

  dst_id: string;

  valid_from: Date | null;

  valid_to: Date | null;

  attrs: Record<string, unknown>;

  sources: string[];

  promoted_from: ProposalsId;

  created_at: Date;

  updated_at: Date;

  proposed_type: string | null;
}

export interface RelationsInitializer {
  id?: RelationsId;

  type: RelationTypeKey;

  src_kind?: string;

  src_id: string;

  dst_kind?: string;

  dst_id: string;

  valid_from?: Date | null;

  valid_to?: Date | null;

  attrs?: Record<string, unknown>;

  sources: string[];

  promoted_from: ProposalsId;

  created_at?: Date;

  updated_at?: Date;

  proposed_type?: string | null;
}

export interface RelationsMutator {
  id?: RelationsId;

  type?: RelationTypeKey;

  src_kind?: string;

  src_id?: string;

  dst_kind?: string;

  dst_id?: string;

  valid_from?: Date | null;

  valid_to?: Date | null;

  attrs?: Record<string, unknown>;

  sources?: string[];

  promoted_from?: ProposalsId;

  created_at?: Date;

  updated_at?: Date;

  proposed_type?: string | null;
}
