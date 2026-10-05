/** Identifier type for public.trust_list_load */
export type TrustListLoadId = string & { __brand: 'public.trust_list_load' };

export default interface TrustListLoad {
  id: TrustListLoadId;

  file: string;

  sha256: string;

  approved_on: Date;

  reason: string;

  row_count: number;

  loaded_at: Date;
}

export interface TrustListLoadInitializer {
  id?: TrustListLoadId;

  file: string;

  sha256: string;

  approved_on: Date;

  reason: string;

  row_count: number;

  loaded_at?: Date;
}

export interface TrustListLoadMutator {
  id?: TrustListLoadId;

  file?: string;

  sha256?: string;

  approved_on?: Date;

  reason?: string;

  row_count?: number;

  loaded_at?: Date;
}
