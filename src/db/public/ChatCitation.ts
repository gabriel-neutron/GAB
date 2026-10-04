import type { ChatMessageId } from './ChatMessage';
import type { DocumentsId } from './Documents';
import type { EntitiesId } from './Entities';
import type { RelationsId } from './Relations';
import type { ProposalsId } from './Proposals';

/** Identifier type for public.chat_citation */
export type ChatCitationId = string & { __brand: 'public.chat_citation' };

export default interface ChatCitation {
  id: ChatCitationId;

  message_id: ChatMessageId;

  position: number;

  document_id: DocumentsId | null;

  entity_id: EntitiesId | null;

  relation_id: RelationsId | null;

  proposal_id: ProposalsId | null;

  excerpt: string | null;
}

export interface ChatCitationInitializer {
  id?: ChatCitationId;

  message_id: ChatMessageId;

  position: number;

  document_id?: DocumentsId | null;

  entity_id?: EntitiesId | null;

  relation_id?: RelationsId | null;

  proposal_id?: ProposalsId | null;

  excerpt?: string | null;
}

export interface ChatCitationMutator {
  id?: ChatCitationId;

  message_id?: ChatMessageId;

  position?: number;

  document_id?: DocumentsId | null;

  entity_id?: EntitiesId | null;

  relation_id?: RelationsId | null;

  proposal_id?: ProposalsId | null;

  excerpt?: string | null;
}
