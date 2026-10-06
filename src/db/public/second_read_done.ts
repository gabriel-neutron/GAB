export interface second_read_done_params {
  p_job: string;

  p_chunk_hash: string;

  p_reader_fingerprint: string;

  p_input_form: string;
}

export type second_read_done_return_type = boolean;
