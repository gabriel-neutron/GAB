/** Identifier type for public.document_provider */
export type DocumentProviderId = string & { __brand: 'public.document_provider' };

export default interface DocumentProvider {
  id: DocumentProviderId;

  name: string;

  licence: string;

  originator_id: string | null;

  created_at: Date;
}

export interface DocumentProviderInitializer {
  id: DocumentProviderId;

  name: string;

  licence: string;

  originator_id?: string | null;

  created_at?: Date;
}

export interface DocumentProviderMutator {
  id?: DocumentProviderId;

  name?: string;

  licence?: string;

  originator_id?: string | null;

  created_at?: Date;
}
