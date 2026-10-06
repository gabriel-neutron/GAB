import type { ProposalsId } from './Proposals';
import type { DocumentsId } from './Documents';
import type { DocumentTextPage, DocumentTextExtractor } from './DocumentText';

/** Identifier type for public.citation */
export type CitationId = string & { __brand: 'public.citation' };

export default interface Citation {
  id: CitationId;

  claim_id: ProposalsId;

  doc_id: DocumentsId;

  page: DocumentTextPage;

  start: number;

  end: number;

  modality: string;

  created_at: Date;

  text_extractor: DocumentTextExtractor;
}

export interface CitationInitializer {
  id?: CitationId;

  claim_id: ProposalsId;

  doc_id: DocumentsId;

  page: DocumentTextPage;

  start: number;

  end: number;

  modality: string;

  created_at?: Date;

  text_extractor: DocumentTextExtractor;
}

export interface CitationMutator {
  id?: CitationId;

  claim_id?: ProposalsId;

  doc_id?: DocumentsId;

  page?: DocumentTextPage;

  start?: number;

  end?: number;

  modality?: string;

  created_at?: Date;

  text_extractor?: DocumentTextExtractor;
}
