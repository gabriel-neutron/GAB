/**
 * The full page of one entity. **The first of the two components this feature exports.**
 *
 * Two panes, and they scroll on their own. On the left the record, one claim to a line; on the
 * right every cited document once, numbered. A badge on the left moves the right pane to its
 * card, so the analyst never scrolls one pane to keep his place in the other.
 *
 * **The score is not on the claim line.** A badge is a number, and the score with its origin
 * lives in the rail, once for each document. Decided by the operator; reported to #12.
 *
 * It is a **prototype**, and it is read-only. Each control is disabled, because the write path is
 * a promotion (P1, invariant 5) and #42 is open and blocking.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DocId } from '@/shared/fixtures/types';
import { FoldedClaims, GroupedClaims, TableClaims, type ClaimsViewProps } from './claim-views';
import {
  attributeEntries,
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
  PrototypeIndex,
  ProvenanceFooter,
  RailBadges,
  RelationRow,
  SourceCard,
  sourceNumber,
} from './prototype-parts';
import type { VariantKey } from './prototype-variants';

export interface DetailPageProps {
  readonly entityId: string;
  readonly variant: VariantKey;
  /** A source to open on arrival. The sidebar sends one here, in a new tab. */
  readonly initialSource: string;
}

export function DetailPage({ entityId, variant, initialSource }: DetailPageProps) {
  const entity = findEntity(entityId);
  const [active, setActive] = useState<DocId | null>(initialSource === '' ? null : initialSource);
  const cards = useRef(new Map<DocId, HTMLDivElement>());

  const show = useCallback((docId: DocId): void => {
    setActive(docId);
    cards.current.get(docId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  // The arrival case. The card is mounted by now, so the same move works without animation.
  useEffect(() => {
    if (initialSource === '') return;
    cards.current.get(initialSource)?.scrollIntoView({ block: 'nearest' });
  }, [initialSource]);

  if (entity === undefined) return <PrototypeIndex search={`?variant=${variant}&surface=page`} />;

  const order = pageSourceOrder(entity);
  const direct = directRelations(entity.id);
  const second = relationsAboutRelations(direct);
  const pending = pendingProposals(entity.id);

  const badges = (ids: readonly DocId[]) => (
    <RailBadges ids={ids} order={order} active={active} onSelect={show} />
  );

  const view: ClaimsViewProps = { entity, badges, compact: false };

  return (
    <div className="flex h-[calc(100svh-6rem)] flex-col">
      <EntityHeading entity={entity} compact={false} />
      <LabellingBanner />

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_27rem] gap-3">
        {/* Left pane — the record. */}
        <div className="min-h-0 overflow-y-auto pr-1">
          {variant === 'A' && <GroupedClaims {...view} />}
          {variant === 'B' && <TableClaims {...view} />}
          {variant === 'C' && <FoldedClaims {...view} />}

          <Heading>Relations · {direct.length + second.length}</Heading>
          {[...direct, ...second].map((relation) => (
            <RelationRow key={relation.id} relation={relation} badges={badges(relation.sources)} />
          ))}

          {pending.length > 0 && (
            <>
              <Heading>Pending, and outside the record above</Heading>
              {pending.map((proposal) => (
                <PendingProposalRow
                  key={proposal.id}
                  proposal={proposal}
                  badges={badges(proposal.src)}
                />
              ))}
            </>
          )}

          <Heading>This row · {attributeEntries(entity.attrs).length} claims</Heading>
          <div className="flex items-center gap-2 py-0.5">
            <span className="flex-1 text-xs text-muted-foreground">Sources of the entity</span>
            {badges(entity.sources)}
          </div>
          <ProvenanceFooter entity={entity} />
        </div>

        {/* Right pane — the sources, once each, numbered, and scrolled to by the badges. */}
        <div className="min-h-0 overflow-y-auto border-l border-border pl-3">
          <Heading>Sources · {order.length}</Heading>
          <div className="space-y-2 pt-1">
            {order.map((docId) => (
              <div
                key={docId}
                ref={(element) => {
                  if (element === null) cards.current.delete(docId);
                  else cards.current.set(docId, element);
                }}
                className={`border p-2 transition-colors ${
                  active === docId ? 'border-foreground bg-muted/50' : 'border-border'
                }`}
              >
                <SourceCard number={sourceNumber(order, docId)} docId={docId} entity={entity} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="sticky top-0 z-10 bg-background pt-3 pb-0.5 text-[0.7rem] font-medium tracking-widest uppercase">
      {children}
    </h2>
  );
}
