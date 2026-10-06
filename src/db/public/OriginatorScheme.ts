/** Identifier type for public.originator_scheme */
export type OriginatorSchemeScheme = string & { __brand: 'public.originator_scheme' };

export default interface OriginatorScheme {
  scheme: OriginatorSchemeScheme;
}

export interface OriginatorSchemeInitializer {
  scheme: OriginatorSchemeScheme;
}

export interface OriginatorSchemeMutator {
  scheme?: OriginatorSchemeScheme;
}
