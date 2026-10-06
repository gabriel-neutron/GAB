/** Identifier type for public.strong_id_kind */
export type StrongIdKindVersion = number & { __brand: 'public.strong_id_kind' };

/** Identifier type for public.strong_id_kind */
export type StrongIdKindKind = string & { __brand: 'public.strong_id_kind' };

export default interface StrongIdKind {
  version: StrongIdKindVersion;

  kind: StrongIdKindKind;
}

export interface StrongIdKindInitializer {
  version: StrongIdKindVersion;

  kind: StrongIdKindKind;
}

export interface StrongIdKindMutator {
  version?: StrongIdKindVersion;

  kind?: StrongIdKindKind;
}
