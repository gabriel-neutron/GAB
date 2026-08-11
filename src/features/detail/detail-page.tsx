/**
 * The full page of one entity. **The first of the two components this feature exports.**
 *
 * It is a **prototype**: three layouts live behind `variant`, and the losers go to a throwaway
 * branch once the operator picks one. Everything it draws is read-only. The controls are
 * disabled, because the write path is a promotion (P1, invariant 5) and #42 is open.
 */

import { findEntity } from './prototype-data';
import { PrototypeIndex } from './prototype-parts';
import type { VariantKey } from './prototype-variants';
import { LedgerPage } from './variant-a-ledger';
import { AuditPage } from './variant-b-audit';
import { SourceFirstPage } from './variant-c-source-first';

export interface DetailSurfaceProps {
  readonly entityId: string;
  readonly variant: VariantKey;
}

export function DetailPage({ entityId, variant }: DetailSurfaceProps) {
  const entity = findEntity(entityId);

  if (entity === undefined) {
    return <PrototypeIndex search={`?variant=${variant}&surface=page`} />;
  }

  switch (variant) {
    case 'A':
      return <LedgerPage entity={entity} />;
    case 'B':
      return <AuditPage entity={entity} />;
    case 'C':
      return <SourceFirstPage entity={entity} />;
  }
}
