import type { DocId } from '@/shared/read/model';

/** The two surfaces that draw one named entity. Each reads the identity from the address. */
export type Surface = 'map' | 'graph';

// These exports are one job: each builds an address of this application, and each holds the one
// encoding rule. No identifier shape is settled, so an unencoded `&`, `#`, `?` or space would
// cut an address short or add a parameter of its own, and it does it in silence.
export const entityHref = (entityId: string, source: DocId | null): string => {
  const page = `/entity/${encodeURIComponent(entityId)}`;
  return source === null ? page : `${page}?src=${encodeURIComponent(source)}`;
};

export const surfaceHref = (
  surface: Surface,
  id: string,
  kind: 'entity' | 'relation' = 'entity',
): string => `/${surface}?${kind}=${encodeURIComponent(id)}`;

/** The address of the timeline of a vessel: its IMO number, as the permanent address has it. */
export const vesselHref = (imo: string): string => `/vessel/${encodeURIComponent(imo)}`;

/** The address of the page of one claim, or of one relation: the identifier is the path, as the
 * permanent address has it, so an identifier with a `/` keeps its folders. */
export const claimHref = (claimId: string): string =>
  `/claim/${claimId.split('/').map(encodeURIComponent).join('/')}`;
