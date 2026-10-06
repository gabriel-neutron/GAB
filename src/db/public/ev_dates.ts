export interface ev_dates_params {
  p_text: string;

  p_locale: string;
}

export interface ev_dates_return_type {
  literal: string | null;

  parsed: Date | null;

  ambiguous: boolean | null;
}
