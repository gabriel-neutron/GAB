export interface add_citation_params {
  p_job: string;

  p_claim: string;

  p_text_extractor: string;

  p_page: number;

  p_start: number;

  p_end: number;

  p_modality: string;
}

export type add_citation_return_type = string;
