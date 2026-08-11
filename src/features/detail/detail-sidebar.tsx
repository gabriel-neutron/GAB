/**
 * The narrow sidebar of one entity. **The second of the two components this feature exports.**
 *
 * It composes nothing itself: ADR 0004 §5 refuses a feature that imports a feature, so the
 * **route** puts this beside the map or the graph. It carries its own width and its own scroll,
 * and it knows nothing about what stands next to it.
 *
 * The one difference from the page: there is no room for a source rail, so a badge opens the
 * source in a popover, and the popover carries one way out — the full page, in a new tab, opened
 * at that source.
 */

import type { Entity } from '@/shared/fixtures/types';
import { FoldedClaims, GroupedClaims, TableClaims, type ClaimsViewProps } from './claim-views';
import {
  directRelations,
  findEntity,
  pageSourceOrder,
  pendingProposals,
  relationsAboutRelations,
} from './prototype-data';
import {
  EntityHeading,
  LabellingBanner,
  PendingProposalRow,
  PopoverBadges,
  PrototypeIndex,
  ProvenanceFooter,
  RelationRow,
} from './prototype-parts';
import type { VariantKey } from './prototype-variants';

/**
 * `variant` is optional on purpose. Two other routes — the map and the graph — already put this
 * sidebar beside their canvas, and a required property would break both every time this
 * prototype tries a fourth reading. A host that does not choose gets the grouped one.
 */
export function DetailSidebar({
  entityId,
  variant = 'A',
}: {
  entityId: string;
  variant?: VariantKey;
}) {
  const entity = findEntity(entityId);

  return (
    <aside className="flex w-[24rem] shrink-0 flex-col overflow-y-auto border-l border-border bg-sidebar px-2 text-sidebar-foreground">
      {entity === undefined ? (
        <PrototypeIndex search={`?variant=${variant}&surface=sidebar`} />
      ) : (
        <SidebarBody entity={entity} variant={variant} />
      )}
    </aside>
  );
}

function SidebarBody({ entity, variant }: { entity: Entity; variant: VariantKey }) {
  const order = pageSourceOrder(entity);
  const direct = directRelations(entity.id);
  const second = relationsAboutRelations(direct);
  const pending = pendingProposals(entity.id);

  const badges = (ids: readonly string[]) => (
    <PopoverBadges ids={ids} order={order} entity={entity} />
  );

  const view: ClaimsViewProps = { entity, badges, compact: true };

  return (
    <div className="pt-2">
      <EntityHeading entity={entity} compact={true} />
      <LabellingBanner />

      {variant === 'A' && <GroupedClaims {...view} />}
      {variant === 'B' && <TableClaims {...view} />}
      {variant === 'C' && <FoldedClaims {...view} />}

      <Heading>Relations · {direct.length + second.length}</Heading>
      {[...direct, ...second].map((relation) => (
        <RelationRow key={relation.id} relation={relation} badges={badges(relation.sources)} />
      ))}

      {pending.length > 0 && (
        <>
          <Heading>Pending</Heading>
          {pending.map((proposal) => (
            <PendingProposalRow
              key={proposal.id}
              proposal={proposal}
              badges={badges(proposal.src)}
            />
          ))}
        </>
      )}

      <Heading>This row</Heading>
      <div className="flex items-center gap-2 py-0.5">
        <span className="flex-1 text-xs text-muted-foreground">Sources of the entity</span>
        {badges(entity.sources)}
      </div>
      <ProvenanceFooter entity={entity} />
      <div className="h-16" />
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="sticky top-0 z-10 bg-sidebar pt-3 pb-0.5 text-[0.7rem] font-medium tracking-widest uppercase">
      {children}
    </h2>
  );
}
