import type { ProposalsId } from './Proposals';
import type { DocumentsId } from './Documents';

/** Identifier type for public.citation */
export type CitationId = string & { __brand: 'public.citation' };

export default interface Citation {
  id: CitationId;

  claim_id: ProposalsId;

  doc_id: DocumentsId;

  page: number;

  start: number;

  end: number;

  modality: string;

  created_at: Date;
}

export interface CitationInitializer {
  id?: CitationId;

  claim_id: ProposalsId;

  doc_id: DocumentsId;

  page: number;

  start: number;

  end: number;

  modality: string;

  created_at?: Date;
}

export interface CitationMutator {
  id?: CitationId;

  claim_id?: ProposalsId;

  doc_id?: DocumentsId;

  page?: number;

  start?: number;

  end?: number;

  modality?: string;

  created_at?: Date;
}
