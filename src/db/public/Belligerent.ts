/** Identifier type for public.belligerent */
export type BelligerentCode = string & { __brand: 'public.belligerent' };

/** Identifier type for public.belligerent */
export type BelligerentConflict = string & { __brand: 'public.belligerent' };

export default interface Belligerent {
  code: BelligerentCode;

  conflict: BelligerentConflict;

  name: string;

  approved_sha256: string;

  approved_on: Date;
}

export interface BelligerentInitializer {
  code: BelligerentCode;

  conflict: BelligerentConflict;

  name: string;

  approved_sha256: string;

  approved_on: Date;
}

export interface BelligerentMutator {
  code?: BelligerentCode;

  conflict?: BelligerentConflict;

  name?: string;

  approved_sha256?: string;

  approved_on?: Date;
}
