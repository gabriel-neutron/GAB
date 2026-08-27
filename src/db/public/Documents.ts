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
}
