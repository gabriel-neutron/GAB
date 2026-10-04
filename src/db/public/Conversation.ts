import type { EntitiesId } from './Entities';
import type { RelationsId } from './Relations';

/** Identifier type for public.conversation */
export type ConversationId = string & { __brand: 'public.conversation' };

export default interface Conversation {
  id: ConversationId;

  anchor_entity_id: EntitiesId | null;

  anchor_relation_id: RelationsId | null;

  title: string;

  created_at: Date;
}

export interface ConversationInitializer {
  id?: ConversationId;

  anchor_entity_id?: EntitiesId | null;

  anchor_relation_id?: RelationsId | null;

  title: string;

  created_at?: Date;
}

export interface ConversationMutator {
  id?: ConversationId;

  anchor_entity_id?: EntitiesId | null;

  anchor_relation_id?: RelationsId | null;

  title?: string;

  created_at?: Date;
}
