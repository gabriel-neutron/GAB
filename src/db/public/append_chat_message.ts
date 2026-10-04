export interface append_chat_message_params {
  p_conversation_id: string;

  p_role: string;

  p_text: string;

  p_model_call_id?: string;

  p_citations?: Record<string, unknown>;
}

export type append_chat_message_return_type = string;
