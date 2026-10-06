export default interface CitationCheckCurrent {
  id: string;

  citation_id: string;

  claim_id: string;

  doc_id: string;

  job_id: string;

  span_result: string;

  support: string;

  counts: boolean;

  hidden_text: boolean;

  window_run: boolean;

  negation: boolean;

  attribution: boolean;

  allegation: boolean;

  denial: boolean;

  hedge: boolean;

  future: boolean;

  conditional: boolean;

  question: boolean;

  court_act: boolean;

  identity: string;

  ocr: boolean;

  same_family: string;

  held: Record<string, unknown>;

  reading_ids: string[];

  list_version: number;

  probe_run_id: string;

  created_at: Date;
}
