import type { CitationId } from './Citation';
import type { ProposalsId } from './Proposals';
import type { DocumentsId } from './Documents';
import type { JobsId } from './Jobs';

/** Identifier type for public.citation_check */
export type CitationCheckId = string & { __brand: 'public.citation_check' };

export default interface CitationCheck {
  id: CitationCheckId;

  citation_id: CitationId;

  claim_id: ProposalsId;

  doc_id: DocumentsId;

  job_id: JobsId;

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

  probe_run_id: string | null;

  idempotency_key: string;

  created_at: Date;
}

export interface CitationCheckInitializer {
  id?: CitationCheckId;

  citation_id: CitationId;

  claim_id: ProposalsId;

  doc_id: DocumentsId;

  job_id: JobsId;

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

  probe_run_id?: string | null;

  idempotency_key: string;

  created_at?: Date;
}

export interface CitationCheckMutator {
  id?: CitationCheckId;

  citation_id?: CitationId;

  claim_id?: ProposalsId;

  doc_id?: DocumentsId;

  job_id?: JobsId;

  span_result?: string;

  support?: string;

  counts?: boolean;

  hidden_text?: boolean;

  window_run?: boolean;

  negation?: boolean;

  attribution?: boolean;

  allegation?: boolean;

  denial?: boolean;

  hedge?: boolean;

  future?: boolean;

  conditional?: boolean;

  question?: boolean;

  court_act?: boolean;

  identity?: string;

  ocr?: boolean;

  same_family?: string;

  held?: Record<string, unknown>;

  reading_ids?: string[];

  list_version?: number;

  probe_run_id?: string | null;

  idempotency_key?: string;

  created_at?: Date;
}
