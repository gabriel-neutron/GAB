export interface propose_change_params {
  p_op: string;

  p_payload: Record<string, unknown>;

  p_src: string[];

  p_target_kind?: string;

  p_target_id?: string;

  p_names?: string[];

  p_confidence?: string;

  p_dissent?: boolean;
}

export type propose_change_return_type = string;
