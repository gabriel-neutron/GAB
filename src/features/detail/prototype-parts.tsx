/**
 * **PROTOTYPE — throwaway.** The parts every variant is free to use. A part is an atom — a chip,
 * a control, a card. **No layout lives here**: each variant throws the layout away and builds
 * its own, which is the point of the exercise.
 */

import { useId } from 'react';
import type {
  Attribute,
  DocId,
  DocumentRow,
  Entity,
  Proposal,
  Relation,
} from '@/shared/fixtures/types';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { keyToLabel, shapeOf, shapeWord } from './attribute-shape';
import {
  allEntities,
  findDocument,
  promotingProposal,
  relationInterval,
  relationSentence,
} from './prototype-data';

/**
 * #12 obligation 3 and 4, drawn. S1 scores the **document**, so a score shown against a claim
 * would be false; and S3 leaves the scoring unmeasured, so the surface says so.
 *
 * **The words are a placeholder.** #12 must produce the exact text, and a prototype must not
 * settle it. What this shows is the **place** and the **rank** the label needs.
 */
export function LabellingBanner() {
  return (
    <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      Every value below is a{' '}
      <strong className="font-medium text-foreground">candidate claim</strong>. A score belongs to
      the source document, never to the claim (S1). The scoring is automated and unmeasured (S3).
      Placeholder words — #12 writes the real ones.
    </p>
  );
}

/**
 * The source mark of UC2. Neutral by decision: `A1` and `D4` get the same shape, so the analyst
 * judges and the interface does not. An unrated document says so, because invariant 6 makes the
 * rating and its origin absent together and an absence must never read as a low score.
 */
export function SourceScoreChip({ docId }: { docId: DocId }) {
  const document = findDocument(docId);

  if (document === undefined) {
    return (
      <Badge variant="destructive" title={`No document row carries ${docId}`}>
        {docId} · not in documents
      </Badge>
    );
  }

  const rated = document.admiralty !== null && document.admiraltyOrigin !== null;

  return (
    <Badge variant="outline" className="gap-1.5 font-normal" title={document.title}>
      <span className="font-mono text-[0.7rem] tracking-wide">
        {rated ? document.admiralty : 'not rated'}
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">
        {rated ? `origin ${document.admiraltyOrigin}` : 'no origin'}
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="max-w-40 truncate">{shortTitle(document)}</span>
    </Badge>
  );
}

function shortTitle(document: DocumentRow): string {
  return document.kind === 'manual' ? 'entered by hand' : document.title;
}

/** The inline, non-bypassable mark. It is never behind a control, on either surface. */
export function SourceChipRow({ ids }: { ids: readonly DocId[] }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {ids.map((id) => (
        <SourceScoreChip key={id} docId={id} />
      ))}
      {ids.length > 1 && (
        <span className="text-xs text-muted-foreground">
          {ids.length} sources — a change of score on either reaches this claim (S1)
        </span>
      )}
    </span>
  );
}

/**
 * UC3, and #31. The bucket is private and the bytes are never served, so a reader is given three
 * things and all three are always drawn: the original address, the web-archive address, and the
 * hash recorded at ingest. An absent one says it is absent.
 */
export function DocumentCard({ docId }: { docId: DocId }) {
  const document = findDocument(docId);

  if (document === undefined) {
    return (
      <div className="rounded-lg border border-destructive/40 p-3 text-sm">
        <p className="font-medium">{docId}</p>
        <p className="text-muted-foreground">
          Cited, and no row in <code>documents</code> carries it. Invariant 2 requires one; the tier
          that proves it is open (#15).
        </p>
      </div>
    );
  }

  const rated = document.admiralty !== null && document.admiraltyOrigin !== null;

  return (
    <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{document.title}</p>
        <Badge variant="secondary" className="font-normal">
          {document.kind}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        {rated ? (
          <>
            Source score <span className="font-mono text-foreground">{document.admiralty}</span>,
            origin <span className="text-foreground">{document.admiraltyOrigin}</span>. It scores
            the document, not the claim (S1).
          </>
        ) : (
          <>
            Not rated. The rating and its origin are absent together, which is what invariant 6
            requires. This is not a low score.
          </>
        )}
      </p>

      <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1 text-xs">
        <Address label="Original address" value={document.uri} />
        <Address label="Web archive" value={document.archiveUri} />
        <dt className="text-muted-foreground">File hash</dt>
        <dd className="font-mono break-all">
          {document.sha256 ?? <span className="font-sans text-muted-foreground">not recorded</span>}
        </dd>
        <dt className="text-muted-foreground">Retrieved</dt>
        <dd>
          {document.retrievedAt ?? <span className="text-muted-foreground">not recorded</span>}
        </dd>
      </dl>

      <p className="text-xs text-muted-foreground">
        The file itself is not served. The bucket is private (#31), so these three lines are the
        whole of what a reader gets.
      </p>
    </div>
  );
}

function Address({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all">
        {value === null ? (
          <span className="text-muted-foreground">not recorded</span>
        ) : (
          <a className="underline underline-offset-2" href={value} rel="noreferrer noopener">
            {value}
          </a>
        )}
      </dd>
    </>
  );
}

/**
 * UC1. The control is chosen from the value, and it is **disabled**: it shows the shape an edit
 * surface would take and it writes nothing. #42 is open and blocking, so a live edit here would
 * settle it, which `CLAUDE.md` forbids.
 */
export function ValueControl({
  attributeKey,
  attribute,
}: {
  attributeKey: string;
  attribute: Attribute;
}) {
  const id = useId();
  const shape = shapeOf(attribute.v);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {shape.kind === 'boolean' && (
          <input
            id={id}
            type="checkbox"
            checked={shape.value}
            readOnly
            disabled
            className="size-4 accent-foreground"
            aria-label={keyToLabel(attributeKey)}
          />
        )}
        {shape.kind === 'number' && (
          <Input id={id} type="number" value={shape.value} readOnly disabled className="max-w-48" />
        )}
        {shape.kind === 'date' && (
          <Input id={id} type="date" value={shape.value} readOnly disabled className="max-w-48" />
        )}
        {shape.kind === 'text' && (
          <Input id={id} type="text" value={shape.value} readOnly disabled className="max-w-80" />
        )}
        {shape.kind === 'note' && (
          <textarea
            id={id}
            value={shape.value}
            readOnly
            disabled
            rows={2}
            className="w-full max-w-140 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm disabled:opacity-50 dark:bg-input/30"
          />
        )}
        {shape.kind === 'list' && (
          <span className="flex flex-wrap gap-1">
            {shape.value.map((item) => (
              <Input
                key={String(item)}
                type="text"
                value={String(item)}
                readOnly
                disabled
                className="w-24"
              />
            ))}
          </span>
        )}
        <span className="text-xs text-muted-foreground">{shapeWord(shape)}, disabled</span>
      </div>
    </div>
  );
}

/** The plain value, where a variant wants to read and not to edit. */
export function PlainValue({ attribute }: { attribute: Attribute }) {
  const shape = shapeOf(attribute.v);
  if (shape.kind === 'boolean') return <span>{shape.value ? 'yes' : 'no'}</span>;
  if (shape.kind === 'list') return <span>{shape.value.join(', ')}</span>;
  return <span>{String(shape.value)}</span>;
}

export function GeometryLine({ entity }: { entity: Entity }) {
  return (
    <p className="text-xs text-muted-foreground">
      {entity.geom === null
        ? 'No geometry. This entity is on no map, and the sidebar must open from the graph instead.'
        : `Point ${entity.geom.lat.toFixed(4)}, ${entity.geom.lon.toFixed(4)}`}
    </p>
  );
}

export function RelationLine({ relation }: { relation: Relation }) {
  const interval = relationInterval(relation);
  // The mark comes from the relation, never from the list it was put in. The `contradicts` row
  // of the sample is a **direct** relation of one entity and an invisible one at the same time,
  // so a mark that a list decides is a mark that goes missing.
  const hidden = relation.srcKind === 'relation' || relation.dstKind === 'relation';

  return (
    <li className="space-y-1 border-b border-border py-2 last:border-b-0">
      <p className="text-sm">{relationSentence(relation)}</p>
      {hidden && (
        <p className="text-xs text-muted-foreground">
          An endpoint is a relation (M4). The graph does not draw this one, so this screen is the
          only way to it — ADR 0004 §4.
        </p>
      )}
      {interval !== null && <p className="text-xs text-muted-foreground">Valid {interval}</p>}
      <SourceChipRow ids={relation.sources} />
      {Object.entries(relation.attrs).map(([key, attribute]) => (
        <p key={key} className="text-xs">
          <span className="text-muted-foreground">{keyToLabel(key)}: </span>
          <PlainValue attribute={attribute} /> <SourceChipRow ids={attribute.src} />
        </p>
      ))}
    </li>
  );
}

/**
 * #10 asks how a pending proposal appears on the graph. The detail surface has the same problem
 * and it is drawn here so that the two answers can be one: a candidate is marked, never mixed
 * into the evidentiary rows above it.
 */
export function PendingProposalCard({ proposal }: { proposal: Proposal }) {
  return (
    <div className="space-y-1 rounded-lg border border-dashed border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-normal">
          candidate, not promoted
        </Badge>
        <span className="text-xs text-muted-foreground">
          {proposal.op} · confidence {proposal.confidence} ·{' '}
          {proposal.dissent ? 'dissent' : 'no dissent'} · {proposal.authorRole}
        </span>
      </div>
      {proposal.payload.kind === 'attrs' &&
        Object.entries(proposal.payload.attrs).map(([key, attribute]) => (
          <p key={key} className="text-sm">
            <span className="text-muted-foreground">{keyToLabel(key)} → </span>
            <PlainValue attribute={attribute} /> <SourceChipRow ids={attribute.src} />
          </p>
        ))}
      <p className="text-xs text-muted-foreground">
        {proposal.dissent || proposal.confidence < 0.9
          ? 'Review by exception sends this to a human (S3).'
          : 'No dissent and high confidence. What happens to this row is open and blocking — #42.'}
      </p>
    </div>
  );
}

/** #15 and #45. The row names the proposal that made it. The stored prompt is **not** drawn. */
export function ProvenanceBlock({ entity }: { entity: Entity }) {
  const proposal = promotingProposal(entity.promotedFrom);

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>
        Promoted from proposal <code className="break-all">{entity.promotedFrom}</code>. One door
        in, and one proposal makes one row (#15).
      </p>
      <p>
        {proposal === undefined
          ? 'The sample carries no proposal row for it, so the trail stops here.'
          : `Decided ${proposal.decidedAt ?? 'not yet'} by ${proposal.decidedBy ?? 'nobody'}, from call ${proposal.callId}.`}
      </p>
      <p>
        The stored rendered prompt of that call is{' '}
        <strong className="font-medium">not shown</strong>. It holds retrieved source text and #45
        is open, so drawing it would settle the question.
      </p>
    </div>
  );
}

/**
 * The application has no navigation (ADR 0004, "not decided here"), and an entity identifier is a
 * UUID nobody types. This is the prototype's way in, and it is not a design.
 */
export function PrototypeIndex({ search }: { search: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-lg font-medium">No entity carries this identifier</h1>
      <p className="text-sm text-muted-foreground">
        The sample of #46 holds five. Pick one — the prototype has no navigation.
      </p>
      <ul className="space-y-1 text-sm">
        {allEntities.map((entity) => (
          <li key={entity.id}>
            <a className="underline underline-offset-2" href={`/entity/${entity.id}${search}`}>
              {entity.label}
            </a>
            <span className="text-muted-foreground"> · {entity.type}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EntityHeading({ entity }: { entity: Entity }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="text-lg font-medium">{entity.label}</h1>
        <Badge variant="secondary" className="font-normal">
          {entity.type}
        </Badge>
      </div>
      <p className="font-mono text-xs break-all text-muted-foreground">{entity.id}</p>
      <GeometryLine entity={entity} />
    </div>
  );
}
