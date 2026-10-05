import type { JobsId } from './Jobs';

/** Identifier type for public.model_call */
export type ModelCallId = string & { __brand: 'public.model_call' };

export default interface ModelCall {
  id: ModelCallId;

  job_id: JobsId | null;

  agent: string;

  agent_version: string;

  endpoint: string;

  requested_model: string;

  served_model: string | null;

  prompt_sha256: string;

  input_tokens: number | null;

  output_tokens: number | null;

  latency_ms: number;

  outcome: string;

  created_at: Date;
}

export interface ModelCallInitializer {
  id?: ModelCallId;

  job_id?: JobsId | null;

  agent: string;

  agent_version: string;

  endpoint: string;

  requested_model: string;

  served_model?: string | null;

  prompt_sha256: string;

  input_tokens?: number | null;

  output_tokens?: number | null;

  latency_ms: number;

  outcome: string;

  created_at?: Date;
}

export interface ModelCallMutator {
  id?: ModelCallId;

  job_id?: JobsId | null;

  agent?: string;

  agent_version?: string;

  endpoint?: string;

  requested_model?: string;

  served_model?: string | null;

  prompt_sha256?: string;

  input_tokens?: number | null;

  output_tokens?: number | null;

  latency_ms?: number;

  outcome?: string;

  created_at?: Date;
}
