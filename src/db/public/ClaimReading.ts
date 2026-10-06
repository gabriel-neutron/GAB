import type { ProposalsId } from './Proposals';
import type { DocumentsId } from './Documents';
import type { DocumentTextExtractor, DocumentTextPage } from './DocumentText';
import type { ModelCallId } from './ModelCall';
import type { JobsId } from './Jobs';

/** Identifier type for public.claim_reading */
export type ClaimReadingId = string & { __brand: 'public.claim_reading' };

export default interface ClaimReading {
  id: ClaimReadingId;

  claim_id: ProposalsId | null;

  doc_id: DocumentsId;

  text_extractor: DocumentTextExtractor;

  page: DocumentTextPage;

  start: number;

  end: number;

  modality: string;

  adverse: boolean;

  reader_no: number;

  reader_kind: string;

  model_call_id: ModelCallId | null;

  input_form: string;

  reader_fingerprint: string;

  job_id: JobsId;

  chunk_hash: string;

  idempotency_key: string;

  created_at: Date;

  model_family: string | null;

  parsed: Record<string, unknown> | null;

  act_effect: string | null;
}

export interface ClaimReadingInitializer {
  id?: ClaimReadingId;

  claim_id?: ProposalsId | null;

  doc_id: DocumentsId;

  text_extractor: DocumentTextExtractor;

  page: DocumentTextPage;

  start: number;

  end: number;

  modality: string;

  adverse?: boolean;

  reader_no: number;

  reader_kind: string;

  model_call_id?: ModelCallId | null;

  input_form: string;

  reader_fingerprint: string;

  job_id: JobsId;

  chunk_hash: string;

  idempotency_key: string;

  created_at?: Date;

  model_family?: string | null;

  parsed?: Record<string, unknown> | null;

  act_effect?: string | null;
}

export interface ClaimReadingMutator {
  id?: ClaimReadingId;

  claim_id?: ProposalsId | null;

  doc_id?: DocumentsId;

  text_extractor?: DocumentTextExtractor;

  page?: DocumentTextPage;

  start?: number;

  end?: number;

  modality?: string;

  adverse?: boolean;

  reader_no?: number;

  reader_kind?: string;

  model_call_id?: ModelCallId | null;

  input_form?: string;

  reader_fingerprint?: string;

  job_id?: JobsId;

  chunk_hash?: string;

  idempotency_key?: string;

  created_at?: Date;

  model_family?: string | null;

  parsed?: Record<string, unknown> | null;

  act_effect?: string | null;
}
