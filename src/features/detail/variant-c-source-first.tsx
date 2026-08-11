/**
 * **PROTOTYPE — variant C, "Source first".**
 *
 * The hierarchy is inverted. The page is a list of **documents**, and under each one are the
 * claims and the relations it holds up. A claim with two sources appears under both, marked.
 *
 * The reason to try it: it is the shape that answers "what falls if this source is wrong?" — the
 * S1 question — without a click. Its cost is equally plain: the entity no longer reads as a
 * record, a claim is not in one place, and the reader must assemble it.
 */

import type { Entity } from '@/shared/fixtures/types';
import { keyToLabel } from './attribute-shape';
import {
  attributeEntries,
  citedDocumentIds,
  claimsCiting,
  directRelations,
  findDocument,
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
  SourceScoreChip,
  ValueControl,
} from './prototype-parts';

export function SourceFirstPage({ entity }: { entity: Entity }) {
  const order = citedDocumentIds(entity);
  const direct = directRelations(entity.id);
  const second = relationsAboutRelations(direct);
  const pending = pendingProposals(entity.id);
  const claimCount = attributeEntries(entity.attrs).length;

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-2">
      <EntityHeading entity={entity} />
      <LabellingBanner />
      <p className="text-sm text-muted-foreground">
        {claimCount} claims, held up by {order.length} documents. Each document is below, with what
        falls with it.
      </p>

      {order.map((docId) => {
        const claims = claimsCiting(entity, docId);
        const relations = [...direct, ...second].filter((relation) =>
          relation.sources.includes(docId),
        );

        return (
          <section key={docId} className="space-y-3 rounded-lg border border-border p-3">
            <DocumentCard docId={docId} />

            <div className="space-y-3 pl-3">
              <h3 className="text-sm font-medium">
                {claims.length + relations.length === 0
                  ? 'Cited at the entity level only'
                  : 'What this document holds up'}
              </h3>

              {claims.map(([key, attribute]) => (
                <div key={key} className="space-y-1">
                  <p className="text-xs text-muted-foreground">{keyToLabel(key)}</p>
                  <ValueControl attributeKey={key} attribute={attribute} />
                  {attribute.src.length > 1 && (
                    <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      Also cited by
                      {attribute.src
                        .filter((other) => other !== docId)
                        .map((other) => (
                          <SourceScoreChip key={other} docId={other} />
                        ))}
                    </p>
                  )}
                </div>
              ))}

              {relations.length > 0 && (
                <ul>
                  {relations.map((relation) => (
                    <RelationLine key={relation.id} relation={relation} />
                  ))}
                </ul>
              )}
            </div>
          </section>
        );
      })}

      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Pending, and not part of the record above</h2>
          {pending.map((proposal) => (
            <PendingProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </section>
      )}

      <section className="space-y-2 border-t border-border pt-3">
        <h2 className="text-sm font-medium">Sources of the entity itself</h2>
        <SourceChipRow ids={entity.sources} />
        <ProvenanceBlock entity={entity} />
      </section>
    </div>
  );
}

export function SourceFirstSidebar({ entity }: { entity: Entity }) {
  const order = citedDocumentIds(entity);
  const direct = directRelations(entity.id);
  const second = relationsAboutRelations(direct);
  const pending = pendingProposals(entity.id);

  return (
    <div className="space-y-4">
      <EntityHeading entity={entity} />
      <LabellingBanner />

      <section className="space-y-2">
        <h2 className="text-sm font-medium">By source</h2>
        {order.map((docId) => {
          const claims = claimsCiting(entity, docId);
          const document = findDocument(docId);

          return (
            <details key={docId} className="rounded-lg border border-border p-2">
              <summary className="cursor-pointer space-y-1">
                <SourceScoreChip docId={docId} />
                <span className="block text-xs text-muted-foreground">
                  {claims.length} claims{document === undefined ? '' : `, ${document.kind}`}
                </span>
              </summary>
              <div className="space-y-2 pt-2">
                {claims.map(([key, attribute]) => (
                  <div key={key} className="space-y-1">
                    <p className="text-xs text-muted-foreground">{keyToLabel(key)}</p>
                    <ValueControl attributeKey={key} attribute={attribute} />
                    {attribute.src.length > 1 && (
                      <p className="text-xs text-muted-foreground">
                        Also cited elsewhere — {attribute.src.length} sources (S1)
                      </p>
                    )}
                  </div>
                ))}
                <DocumentCard docId={docId} />
              </div>
            </details>
          );
        })}
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
