export interface record_resolution_params {
  p_originator: string;

  p_claim: string;

  p_claim_document: string;

  p_position: string;

  p_outcome: string;

  p_settled_by: string;

  p_settling_document: string;

  p_operator_note: string;

  p_settling_captured_at: unknown;

  p_claim_document_date: Date;
}

export type record_resolution_return_type = string;
