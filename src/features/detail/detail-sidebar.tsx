/**
 * The narrow sidebar of one entity. **The second of the two components this feature exports.**
 *
 * It is written for a later composition beside the map and the graph, and it composes nothing
 * itself: ADR 0004 §5 refuses a feature that imports a feature, so the **route** puts this one
 * next to a map or a graph. This file therefore carries its own width and its own scroll, and it
 * knows nothing about what stands beside it.
 *
 * The difference from the page is the one the operator asked for: a source is **on demand** here
 * and open on the page. The mark that a source exists is never on demand, on either surface.
 */

import type { Entity } from '@/shared/fixtures/types';
import type { DetailSurfaceProps } from './detail-page';
import { findEntity } from './prototype-data';
import { PrototypeIndex } from './prototype-parts';
import type { VariantKey } from './prototype-variants';
import { LedgerSidebar } from './variant-a-ledger';
import { AuditSidebar } from './variant-b-audit';
import { SourceFirstSidebar } from './variant-c-source-first';

export function DetailSidebar({ entityId, variant }: DetailSurfaceProps) {
  const entity = findEntity(entityId);

  return (
    <aside className="w-[23rem] shrink-0 overflow-y-auto border-l border-border bg-sidebar p-3 text-sidebar-foreground">
      {entity === undefined ? (
        <PrototypeIndex search={`?variant=${variant}&surface=sidebar`} />
      ) : (
        <SidebarBody entity={entity} variant={variant} />
      )}
    </aside>
  );
}

function SidebarBody({ entity, variant }: { entity: Entity; variant: VariantKey }) {
  switch (variant) {
    case 'A':
      return <LedgerSidebar entity={entity} />;
    case 'B':
      return <AuditSidebar entity={entity} />;
    case 'C':
      return <SourceFirstSidebar entity={entity} />;
  }
}
