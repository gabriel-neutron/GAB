export interface propose_change_params {
  p_op: string;

  p_payload: Record<string, unknown>;

  p_src: string[];

  p_target_kind?: string;

  p_target_id?: string;

  p_names?: string[];

  p_confidence?: string;

  p_dissent?: boolean;

  p_model_call_id?: string;

  p_idempotency_key?: string;

  p_job_id?: string;
}

export type propose_change_return_type = string;
