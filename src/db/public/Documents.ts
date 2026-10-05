import type { DocumentProviderId } from './DocumentProvider';

/** Identifier type for public.documents */
export type DocumentsId = string & { __brand: 'public.documents' };

export default interface Documents {
  id: DocumentsId;

  kind: string;

  title: string;

  s3_key: string | null;

  uri: string | null;

  archive_uri: string | null;

  sha256: string | null;

  mime: string | null;

  retrieved_at: Date | null;

  admiralty: string | null;

  admiralty_origin: string | null;

  created_at: Date;

  provider_id: DocumentProviderId | null;

  cost_eur: string | null;
}

export interface DocumentsInitializer {
  id: DocumentsId;

  kind: string;

  title: string;

  s3_key?: string | null;

  uri?: string | null;

  archive_uri?: string | null;

  sha256?: string | null;

  mime?: string | null;

  retrieved_at?: Date | null;

  admiralty?: string | null;

  admiralty_origin?: string | null;

  created_at?: Date;

  provider_id?: DocumentProviderId | null;

  cost_eur?: string | null;
}

export interface DocumentsMutator {
  id?: DocumentsId;

  kind?: string;

  title?: string;

  s3_key?: string | null;

  uri?: string | null;

  archive_uri?: string | null;

  sha256?: string | null;

  mime?: string | null;

  retrieved_at?: Date | null;

  admiralty?: string | null;

  admiralty_origin?: string | null;

  created_at?: Date;

  provider_id?: DocumentProviderId | null;

  cost_eur?: string | null;
}
