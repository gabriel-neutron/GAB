export interface propose_originator_fact_params {
  p_originator: string;

  p_kind: string;

  p_value: Record<string, unknown>;

  p_document: string;

  p_page: number;

  p_start: number;

  p_end: number;
}

export type propose_originator_fact_return_type = string;
