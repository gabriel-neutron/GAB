export interface put_claim_reading_params {
  p_job: string;

  p_claim: string;

  p_text_extractor: string;

  p_page: number;

  p_start: number;

  p_end: number;

  p_modality: string;

  p_adverse: boolean;

  p_model_call: string;

  p_input_form: string;

  p_reader_fingerprint: string;

  p_chunk_hash: string;

  p_idempotency_key: string;
}

export type put_claim_reading_return_type = string;
