export interface ev_parties_params {
  p_claim: string;

  p_text: string;
}

export interface ev_parties_return_type {
  entity_id: string | null;

  label: string | null;

  party_kind: string | null;
}
