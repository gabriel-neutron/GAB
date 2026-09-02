export interface claim_job_params {
  p_worker: string;
}

export interface claim_job_return_type {
  job_id: string | null;

  job_document: unknown;

  job_attempts: number | null;
}
