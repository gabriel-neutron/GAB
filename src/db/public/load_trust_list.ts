export interface load_trust_list_params {
  p_file: string;

  p_sha256: string;

  p_approved_on: Date;

  p_reason: string;

  p_rows: Record<string, unknown>;
}

export type load_trust_list_return_type = number;
