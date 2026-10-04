import type { ConversationId } from './Conversation';
import type { ModelCallId } from './ModelCall';

/** Identifier type for public.chat_message */
export type ChatMessageId = string & { __brand: 'public.chat_message' };

export default interface ChatMessage {
  id: ChatMessageId;

  conversation_id: ConversationId;

  role: string;

  body: string;

  model_call_id: ModelCallId | null;

  created_at: Date;
}

export interface ChatMessageInitializer {
  id?: ChatMessageId;

  conversation_id: ConversationId;

  role: string;

  body: string;

  model_call_id?: ModelCallId | null;

  created_at?: Date;
}

export interface ChatMessageMutator {
  id?: ChatMessageId;

  conversation_id?: ConversationId;

  role?: string;

  body?: string;

  model_call_id?: ModelCallId | null;

  created_at?: Date;
}
