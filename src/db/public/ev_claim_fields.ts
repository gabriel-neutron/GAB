export interface ev_claim_fields_params {
  p_claim: string;
}

export interface ev_claim_fields_return_type {
  field: string | null;

  kind: string | null;

  value: string | null;

  is_subject: boolean | null;
}
