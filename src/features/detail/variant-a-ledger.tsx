/**
 * **PROTOTYPE — variant A, "Ledger".**
 *
 * One column, one row per claim, in the order of the key. The claim is the unit; the document is
 * an appendix of the claim. It is the densest of the three and it scans fastest, and it repeats a
 * document card under every claim that cites it — which is the honest cost of putting the claim
 * first.
 */

import type { Entity } from '@/shared/fixtures/types';
import { keyToLabel } from './attribute-shape';
import {
  attributeEntries,
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

export function LedgerPage({ entity }: { entity: Entity }) {
  const direct = directRelations(entity.id);
  const second = relationsAboutRelations(direct);
  const pending = pendingProposals(entity.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2">
      <EntityHeading entity={entity} />
      <LabellingBanner />

      <section className="space-y-4">
        <h2 className="text-sm font-medium">Claims</h2>
        {attributeEntries(entity.attrs).map(([key, attribute]) => (
          <div key={key} className="space-y-2 border-t border-border pt-3">
            <div className="grid grid-cols-[10rem_1fr] items-start gap-3">
              <p className="pt-1.5 text-sm text-muted-foreground">{keyToLabel(key)}</p>
              <div className="space-y-2">
                <ValueControl attributeKey={key} attribute={attribute} />
                <SourceChipRow ids={attribute.src} />
              </div>
            </div>
            {/* The full page opens every source. The sidebar below does not. */}
            <div className="ml-[10.75rem] space-y-2">
              {attribute.src.map((docId) => (
                <DocumentCard key={docId} docId={docId} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Relations</h2>
        <ul>
          {direct.map((relation) => (
            <RelationLine key={relation.id} relation={relation} />
          ))}
        </ul>
        {second.length > 0 && (
          <>
            <h3 className="pt-2 text-sm font-medium">About those relations</h3>
            <ul>
              {second.map((relation) => (
                <RelationLine key={relation.id} relation={relation} />
              ))}
            </ul>
          </>
        )}
      </section>

      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Pending, and not part of the record above</h2>
          {pending.map((proposal) => (
            <PendingProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </section>
      )}

      <section className="space-y-2 border-t border-border pt-3">
        <h2 className="text-sm font-medium">Where this row came from</h2>
        <SourceChipRow ids={entity.sources} />
        <ProvenanceBlock entity={entity} />
      </section>
    </div>
  );
}

export function LedgerSidebar({ entity }: { entity: Entity }) {
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
          <div key={key} className="space-y-1.5 border-t border-border pt-2">
            <p className="text-xs text-muted-foreground">{keyToLabel(key)}</p>
            <ValueControl attributeKey={key} attribute={attribute} />
            <SourceChipRow ids={attribute.src} />
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                Open the {attribute.src.length === 1 ? 'source' : `${attribute.src.length} sources`}
              </summary>
              <div className="space-y-2 pt-2">
                {attribute.src.map((docId) => (
                  <DocumentCard key={docId} docId={docId} />
                ))}
              </div>
            </details>
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

      <ProvenanceBlock entity={entity} />
    </div>
  );
}
