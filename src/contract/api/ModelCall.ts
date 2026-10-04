import { z } from 'zod';

export default interface ModelCall {
  id: string | null;

  job_id: string | null;

  agent: string | null;

  agent_version: string | null;

  endpoint: string | null;

  requested_model: string | null;

  served_model: string | null;

  prompt_sha256: string | null;

  input_tokens: number | null;

  output_tokens: number | null;

  latency_ms: number | null;

  outcome: string | null;

  created_at: string | null;
}

export const modelCall = z.object({
  id: z.uuid().nullable(),
  job_id: z.uuid().nullable(),
  agent: z.string().nullable(),
  agent_version: z.string().nullable(),
  endpoint: z.string().nullable(),
  requested_model: z.string().nullable(),
  served_model: z.string().nullable(),
  prompt_sha256: z.string().nullable(),
  input_tokens: z.number().nullable(),
  output_tokens: z.number().nullable(),
  latency_ms: z.number().nullable(),
  outcome: z.string().nullable(),
  created_at: z.string().nullable(),
});
