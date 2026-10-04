import type { DocumentsId } from './Documents';

/** Identifier type for public.document_text */
export type DocumentTextExtractor = string & { __brand: 'public.document_text' };

/** Identifier type for public.document_text */
export type DocumentTextPage = number & { __brand: 'public.document_text' };

export default interface DocumentText {
  document_id: DocumentsId;

  extractor: DocumentTextExtractor;

  page: DocumentTextPage;

  text: string;

  created_at: Date;
}

export interface DocumentTextInitializer {
  document_id: DocumentsId;

  extractor: DocumentTextExtractor;

  page: DocumentTextPage;

  text: string;

  created_at?: Date;
}

export interface DocumentTextMutator {
  document_id?: DocumentsId;

  extractor?: DocumentTextExtractor;

  page?: DocumentTextPage;

  text?: string;

  created_at?: Date;
}
