export interface run_evidence_checks_params {
  p_job: string;

  p_claim: string;
}

export interface run_evidence_checks_return_type {
  check_id: string | null;

  citation_id: string | null;

  counts: boolean | null;

  held: Record<string, unknown> | null;

  span_result: string | null;

  support: string | null;

  identity: string | null;

  same_family: string | null;
}
