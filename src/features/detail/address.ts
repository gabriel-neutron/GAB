import type { DocId } from '@/shared/fixtures/types';

/** The two surfaces that draw one named entity. Each reads the identity from the address. */
export type Surface = 'map' | 'graph';

// Both exports are one job: each builds an address of this application, and each holds the one
// encoding rule. No identifier shape is settled, so an unencoded `&`, `#`, `?` or space would
// cut an address short or add a parameter of its own, and it does it in silence.
export const entityHref = (entityId: string, source: DocId | null): string => {
  const page = `/entity/${encodeURIComponent(entityId)}`;
  return source === null ? page : `${page}?src=${encodeURIComponent(source)}`;
};

export const surfaceHref = (surface: Surface, entityId: string): string =>
  `/${surface}?entity=${encodeURIComponent(entityId)}`;
