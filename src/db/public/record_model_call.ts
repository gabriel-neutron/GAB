export interface record_model_call_params {
  p_agent: string;

  p_agent_version: string;

  p_endpoint: string;

  p_requested_model: string;

  p_prompt_sha256: string;

  p_latency_ms: number;

  p_outcome: string;

  p_job_id?: string;

  p_served_model?: string;

  p_input_tokens?: number;

  p_output_tokens?: number;
}

export type record_model_call_return_type = string;
