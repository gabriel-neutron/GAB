export interface compute_originator_letter_params {
  p_id: string;

  p_as_of?: unknown;
}

export interface compute_originator_letter_return_type {
  letter: string | null;

  letter_origin: string | null;

  reason: Record<string, unknown> | null;
}
