import type { EntityTypeKey } from './EntityType';
import type { ProposalsId } from './Proposals';

/** Identifier type for public.entities */
export type EntitiesId = string & { __brand: 'public.entities' };

export default interface Entities {
  id: EntitiesId;

  type: EntityTypeKey;

  proposed_type: string | null;

  label: string;

  geom: string | null;

  attrs: Record<string, unknown>;

  sources: string[];

  promoted_from: ProposalsId;

  created_at: Date;

  updated_at: Date;
}

export interface EntitiesInitializer {
  id?: EntitiesId;

  type: EntityTypeKey;

  proposed_type?: string | null;

  label: string;

  geom?: string | null;

  attrs?: Record<string, unknown>;

  sources: string[];

  promoted_from: ProposalsId;

  created_at?: Date;

  updated_at?: Date;
}

export interface EntitiesMutator {
  id?: EntitiesId;

  type?: EntityTypeKey;

  proposed_type?: string | null;

  label?: string;

  geom?: string | null;

  attrs?: Record<string, unknown>;

  sources?: string[];

  promoted_from?: ProposalsId;

  created_at?: Date;

  updated_at?: Date;
}
