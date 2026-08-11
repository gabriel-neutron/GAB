/**
 * **PROTOTYPE — variant B, "Audit rail".**
 *
 * Two columns. The claims are on the left and every cited document is a numbered card on the
 * right, once each. A claim carries footnote marks, and the marks are the join.
 *
 * The reason to try it: S1 says the score is a property of the document. A rail that lists each
 * document once shows the analyst the whole scored surface of the entity, and it shows at a
 * glance that one weak document holds up three claims. Variant A cannot show that.
 */

import type { DocId, Entity } from '@/shared/fixtures/types';
import { keyToLabel } from './attribute-shape';
import {
  attributeEntries,
  citedDocumentIds,
  directRelations,
  pendingProposals,
  relationsAboutRelations,
} from './prototype-data';
import {
  DocumentCard,
  EntityHeading,
  LabellingBanner,
  PendingProposalCard,
  ProvenanceBlock,
  RelationLine,
  SourceChipRow,
  ValueControl,
} from './prototype-parts';

function markOf(order: readonly DocId[], docId: DocId): string {
  const at = order.indexOf(docId);
  return at === -1 ? '?' : String(at + 1);
}

function FootnoteMarks({ order, ids }: { order: readonly DocId[]; ids: readonly DocId[] }) {
  return (
    <span className="text-xs text-muted-foreground">
      {ids.map((id) => (
        <sup key={id} className="ml-0.5 font-mono">
          [{markOf(order, id)}]
        </sup>
      ))}
    </span>
  );
}

export function AuditPage({ entity }: { entity: Entity }) {
  const order = citedDocumentIds(entity);
  const direct = directRelations(entity.id);
  const second = relationsAboutRelations(direct);
  const pending = pendingProposals(entity.id);

  return (
    <div className="space-y-4 py-2">
      <EntityHeading entity={entity} />
      <LabellingBanner />

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-5">
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Claims</h2>
            {attributeEntries(entity.attrs).map(([key, attribute]) => (
              <div key={key} className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  {keyToLabel(key)}
                  <FootnoteMarks order={order} ids={attribute.src} />
                </p>
                <ValueControl attributeKey={key} attribute={attribute} />
                <SourceChipRow ids={attribute.src} />
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium">Relations</h2>
            <ul>
              {direct.map((relation) => (
                <RelationLine key={relation.id} relation={relation} />
              ))}
              {second.map((relation) => (
                <RelationLine key={relation.id} relation={relation} />
              ))}
            </ul>
          </section>

          {pending.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium">Pending, and not part of the record above</h2>
              {pending.map((proposal) => (
                <PendingProposalCard key={proposal.id} proposal={proposal} />
              ))}
            </section>
          )}

          <ProvenanceBlock entity={entity} />
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <h2 className="text-sm font-medium">
            Sources — {order.length} documents hold up this entity
          </h2>
          {order.map((docId) => (
            <div key={docId} className="flex gap-2">
              <span className="pt-3 font-mono text-xs text-muted-foreground">
                [{markOf(order, docId)}]
              </span>
              <div className="min-w-0 flex-1">
                <DocumentCard docId={docId} />
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

export function AuditSidebar({ entity }: { entity: Entity }) {
  const order = citedDocumentIds(entity);
  const direct = directRelations(entity.id);
  const second = relationsAboutRelations(direct);
  const pending = pendingProposals(entity.id);

  return (
    <div className="space-y-4">
      <EntityHeading entity={entity} />
      <LabellingBanner />

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Claims</h2>
        {attributeEntries(entity.attrs).map(([key, attribute]) => (
          <div key={key} className="space-y-1.5 rounded-lg border border-border p-2">
            <p className="text-xs text-muted-foreground">
              {keyToLabel(key)}
              <FootnoteMarks order={order} ids={attribute.src} />
            </p>
            <ValueControl attributeKey={key} attribute={attribute} />
            <SourceChipRow ids={attribute.src} />
          </div>
        ))}
      </section>

      <section className="space-y-1">
        <h2 className="text-sm font-medium">Relations</h2>
        <ul>
          {direct.map((relation) => (
            <RelationLine key={relation.id} relation={relation} />
          ))}
          {second.map((relation) => (
            <RelationLine key={relation.id} relation={relation} />
          ))}
        </ul>
      </section>

      {pending.map((proposal) => (
        <PendingProposalCard key={proposal.id} proposal={proposal} />
      ))}

      {/* The rail does not fit in a sidebar, so the numbered list moves under one control. The
          marks stay visible above, so the reader always sees that a source exists. */}
      <details className="rounded-lg border border-border p-2">
        <summary className="cursor-pointer text-sm font-medium">
          Sources — {order.length} documents
        </summary>
        <div className="space-y-2 pt-2">
          {order.map((docId) => (
            <div key={docId} className="flex gap-2">
              <span className="pt-3 font-mono text-xs text-muted-foreground">
                [{markOf(order, docId)}]
              </span>
              <div className="min-w-0 flex-1">
                <DocumentCard docId={docId} />
              </div>
            </div>
          ))}
        </div>
      </details>

      <ProvenanceBlock entity={entity} />
    </div>
  );
}
