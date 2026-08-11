/**
 * **PROTOTYPE — throwaway.** The parts of the dense layout.
 *
 * The rule the operator gave, and the reason each part looks as it does: **one claim is one
 * line.** A node carries more than a hundred values, so a row that takes two lines, or that
 * repeats the type of the value, or that writes the word "disabled", costs a screen of reading
 * for nothing. The control already says what the value is, and a grey control already says that
 * it is not editable.
 */

import { useId, useState, type ReactNode } from 'react';
import { Popover } from 'radix-ui';
import type { Attribute, DocId, Entity, Proposal, Relation } from '@/shared/fixtures/types';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { keyToLabel, shapeOf } from './attribute-shape';
import {
  allEntities,
  claimsCiting,
  findDocument,
  promotingProposal,
  relationInterval,
  relationSentence,
} from './prototype-data';

/* -------------------------------------------------------------------------- the source badge */

/**
 * The number is the join with the source rail, and the score rides with it.
 *
 * **The number alone would not be enough.** PU1 asks for the origin *and* the score of every
 * candidate claim, visible and non-bypassable (#12). A bare `[24]` hides the score behind a
 * click. The score therefore stays in the badge, and only an unrated document spends the extra
 * width — which is the document that must never be mistaken for a weak one.
 */
function badgeText(docId: DocId): string {
  const document = findDocument(docId);
  if (document === undefined) return 'not in documents';
  return document.admiralty ?? 'not rated';
}

export function sourceNumber(order: readonly DocId[], docId: DocId): number {
  return order.indexOf(docId) + 1;
}

/** The badge of the full page. It moves the rail on the right; it opens nothing. */
export function RailBadges({
  ids,
  order,
  active,
  onSelect,
}: {
  ids: readonly DocId[];
  order: readonly DocId[];
  active: DocId | null;
  onSelect: (docId: DocId) => void;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            onSelect(id);
          }}
          title={findDocument(id)?.title ?? id}
          className={`flex h-5 items-center gap-1 rounded-4xl border px-1.5 text-[0.7rem] transition-colors hover:bg-muted ${
            active === id ? 'border-foreground bg-muted' : 'border-border'
          }`}
        >
          <span className="font-mono">{sourceNumber(order, id)}</span>
          <span className="text-foreground/70">{badgeText(id)}</span>
        </button>
      ))}
    </span>
  );
}

/**
 * The badge of the sidebar. There is no room for a rail, so the source opens in a popover, and
 * the popover carries one way out: the full page, in a new tab, with that source already open.
 */
export function PopoverBadges({
  ids,
  order,
  entity,
}: {
  ids: readonly DocId[];
  order: readonly DocId[];
  entity: Entity;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {ids.map((id) => (
        <Popover.Root key={id}>
          <Popover.Trigger className="flex h-5 items-center gap-1 rounded-4xl border border-border px-1.5 text-[0.7rem] transition-colors hover:bg-muted">
            <span className="font-mono">{sourceNumber(order, id)}</span>
            <span className="text-foreground/70">{badgeText(id)}</span>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={4}
              className="z-50 w-96 rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-lg"
            >
              <SourceCard number={sourceNumber(order, id)} docId={id} entity={entity} />
              <a
                className="mt-2 block text-xs underline underline-offset-2"
                href={`/entity/${entity.id}?surface=page&src=${id}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                Open the full page at this source, in a new tab
              </a>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------------------- the claim line */

/**
 * UC1, on one line. The control is chosen from the value, because nothing in the model declares
 * a type (reported to #46), and it is disabled, because the write path is a promotion and #42 is
 * open.
 */
function ValueControl({ attributeKey, attribute }: { attributeKey: string; attribute: Attribute }) {
  const id = useId();
  const shape = shapeOf(attribute.v);
  const label = keyToLabel(attributeKey);

  // `disabled` on a shadcn input costs half the opacity, so the value — the most important text
  // on the screen — became the faintest. The opacity is put back to full, and the control says
  // "not editable" with a flat fill and no border instead of by fading its own content.
  const box =
    'h-6 rounded-md border-transparent bg-muted/60 py-0 text-xs disabled:cursor-default ' +
    'disabled:bg-muted/60 disabled:text-foreground disabled:opacity-100 dark:bg-input/50 ' +
    'dark:disabled:bg-input/50';

  if (shape.kind === 'boolean') {
    return (
      <input
        id={id}
        type="checkbox"
        checked={shape.value}
        readOnly
        disabled
        aria-label={label}
        className="size-3.5 accent-foreground opacity-100"
      />
    );
  }

  if (shape.kind === 'list') {
    return (
      <span className="flex items-center gap-1 overflow-x-auto">
        {shape.value.map((item) => (
          <Input
            key={String(item)}
            type="text"
            value={String(item)}
            readOnly
            disabled
            aria-label={label}
            className={`${box} w-24 shrink-0`}
          />
        ))}
      </span>
    );
  }

  const type = shape.kind === 'number' ? 'number' : shape.kind === 'date' ? 'date' : 'text';

  return (
    <Input
      id={id}
      type={type}
      value={String(shape.value)}
      readOnly
      disabled
      aria-label={label}
      title={String(shape.value)}
      className={`${box} ${shape.kind === 'number' || shape.kind === 'date' ? 'w-36' : 'w-full'}`}
    />
  );
}

/** One claim, one line: the name, the control, the badges. Nothing else. */
export function ClaimRow({
  attributeKey,
  attribute,
  badges,
  compact,
}: {
  attributeKey: string;
  attribute: Attribute;
  badges: ReactNode;
  /** The sidebar is 24 rem wide, so the name of the claim gives its width back to the value. */
  compact: boolean;
}) {
  return (
    <div
      className={`grid items-center gap-2 border-b border-border/60 py-0.5 hover:bg-muted/40 ${
        compact ? 'grid-cols-[6.5rem_minmax(0,1fr)_auto]' : 'grid-cols-[10rem_minmax(0,1fr)_auto]'
      }`}
    >
      <span className="truncate text-xs text-muted-foreground" title={keyToLabel(attributeKey)}>
        {keyToLabel(attributeKey)}
      </span>
      <ValueControl attributeKey={attributeKey} attribute={attribute} />
      {badges}
    </div>
  );
}

/* ------------------------------------------------------------------------------- the sources */

/**
 * A source card, cut to what a reader needs at a glance: the number, the title, the score, one
 * address and the date it was retrieved. **A rail of thirty of these must stay scannable**, so
 * everything else waits behind one control.
 *
 * What waits behind it: the claims this document holds up, the web-archive address and the file
 * hash. **#31 is still met**: the reader is given all three of the original address, the archive
 * address and the hash. #31 says a reader gets them; it does not say a rail repeats them thirty
 * times.
 */
export function SourceCard({
  number,
  docId,
  entity,
}: {
  number: number;
  docId: DocId;
  entity: Entity;
}) {
  const [open, setOpen] = useState(false);
  const document = findDocument(docId);
  const claims = claimsCiting(entity, docId);

  if (document === undefined) {
    return (
      <div className="p-1 text-xs">
        <p className="font-medium">
          [{number}] {docId}
        </p>
        <p className="text-muted-foreground">
          Cited, and no row in <code>documents</code> carries it. Invariant 2 requires one; the tier
          that proves it is open (#15).
        </p>
      </div>
    );
  }

  const rated = document.admiralty !== null && document.admiraltyOrigin !== null;

  return (
    <div className="text-xs">
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 font-mono text-muted-foreground">[{number}]</span>
        <p className="min-w-0 flex-1 truncate font-medium" title={document.title}>
          {document.title}
        </p>
        <span
          className="shrink-0 font-mono"
          title={rated ? `Origin of the rating: ${document.admiraltyOrigin}` : undefined}
        >
          {rated ? document.admiralty : 'not rated'}
        </span>
      </div>

      <div className="flex items-baseline gap-2 pt-0.5 text-muted-foreground">
        <span className="min-w-0 flex-1 truncate">
          {document.uri === null ? (
            'no address, the file entered as a scan'
          ) : (
            <a
              className="underline underline-offset-2"
              href={document.uri}
              title={document.uri}
              rel="noreferrer noopener"
            >
              {shortAddress(document.uri)}
            </a>
          )}
        </span>
        <span className="shrink-0">{document.retrievedAt ?? 'no date'}</span>
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
          }}
          aria-expanded={open}
          className="shrink-0 underline underline-offset-2 hover:text-foreground"
        >
          {claims.length} claims
        </button>
      </div>

      {open && (
        <div className="space-y-1 border-t border-border pt-1 pl-6">
          <ul>
            {claims.map(([key, attribute]) => (
              <li key={key} className="flex gap-2">
                <span className="w-40 shrink-0 truncate text-muted-foreground">
                  {keyToLabel(key)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <PlainValue attribute={attribute} />
                </span>
              </li>
            ))}
            {claims.length === 0 && (
              <li className="text-muted-foreground">Cited at the entity or the relation level.</li>
            )}
          </ul>

          <p className="text-muted-foreground">
            {rated
              ? `The score ${document.admiralty} belongs to this document and not to a claim (S1). Origin: ${document.admiraltyOrigin}.`
              : 'Not rated. The rating and its origin are absent together, as invariant 6 requires. This is not a low score.'}
          </p>

          <p className="truncate text-muted-foreground" title={document.archiveUri ?? ''}>
            Web archive:{' '}
            {document.archiveUri === null ? (
              'not recorded'
            ) : (
              <a
                className="underline underline-offset-2"
                href={document.archiveUri}
                rel="noreferrer noopener"
              >
                {shortAddress(document.archiveUri)}
              </a>
            )}
          </p>
          <p className="truncate font-mono text-muted-foreground" title={document.sha256 ?? ''}>
            {document.sha256 ?? 'no hash recorded'}
          </p>
          <p className="text-muted-foreground">
            The file itself is never served: the bucket is private (#31).
          </p>
        </div>
      )}
    </div>
  );
}

/** The address without the scheme. The whole address is on the title and on the link. */
function shortAddress(uri: string): string {
  return uri.replace(/^https?:\/\//, '');
}

/** The value, read and not edited. Used in the list of claims behind a source. */
function PlainValue({ attribute }: { attribute: Attribute }) {
  const shape = shapeOf(attribute.v);
  if (shape.kind === 'boolean') return <>{shape.value ? 'yes' : 'no'}</>;
  if (shape.kind === 'list') return <>{shape.value.join(', ')}</>;
  return <>{String(shape.value)}</>;
}

/* ------------------------------------------------------------------------------ the trimmings */

/** #12, one line. The words are a placeholder; #12 writes the real ones. */
export function LabellingBanner() {
  return (
    <p className="border-y border-border bg-muted/50 px-2 py-1 text-[0.7rem] text-muted-foreground">
      Candidate claims. A score belongs to the source document, never to the claim (S1). The scoring
      is automated and unmeasured (S3). Placeholder words — #12 writes the real ones.
    </p>
  );
}

/**
 * The identifier and the point are on the full page only. In the sidebar they cost a line and
 * they answer nothing: the analyst arrived from the map or from the graph, so he knows where the
 * thing is, and a UUID is not read by eye.
 */
export function EntityHeading({ entity, compact }: { entity: Entity; compact: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <h1 className="text-base font-medium">{entity.label}</h1>
      <Badge variant="secondary" className="h-4 font-normal">
        {entity.type}
      </Badge>
      {!compact && (
        <>
          <span className="font-mono text-[0.7rem] text-muted-foreground">{entity.id}</span>
          <span className="text-[0.7rem] text-muted-foreground">
            {entity.geom === null
              ? '· no geometry, so no map opens this one'
              : `· ${entity.geom.lat.toFixed(4)}, ${entity.geom.lon.toFixed(4)}`}
          </span>
        </>
      )}
    </div>
  );
}

/** A relation is a line too. M4 gets one extra line, because the graph cannot draw it. */
export function RelationRow({ relation, badges }: { relation: Relation; badges: ReactNode }) {
  const interval = relationInterval(relation);
  const hidden = relation.srcKind === 'relation' || relation.dstKind === 'relation';

  return (
    <div className="border-b border-border/60 py-0.5 hover:bg-muted/40">
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate text-xs" title={relationSentence(relation)}>
          {relationSentence(relation)}
        </span>
        {interval !== null && (
          <span className="shrink-0 text-[0.7rem] text-muted-foreground">{interval}</span>
        )}
        {badges}
      </div>
      {hidden && (
        <p className="text-[0.7rem] text-muted-foreground">
          An endpoint is a relation (M4). The graph does not draw this one — ADR 0004 §4.
        </p>
      )}
    </div>
  );
}

/** #10: a candidate is marked and stays outside the record. The graph needs the same words. */
export function PendingProposalRow({
  proposal,
  badges,
}: {
  proposal: Proposal;
  badges: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-dashed border-border py-0.5">
      <Badge variant="outline" className="h-4 shrink-0 font-normal">
        candidate
      </Badge>
      <span className="flex-1 truncate text-xs">
        {proposal.op}
        {proposal.payload.kind === 'attrs' &&
          ` · ${Object.keys(proposal.payload.attrs).map(keyToLabel).join(', ')}`}
      </span>
      <span className="shrink-0 text-[0.7rem] text-muted-foreground">
        {proposal.dissent ? 'dissent' : 'no dissent'} · {proposal.confidence}
        {!proposal.dissent && proposal.confidence >= 0.9 ? ' · open, see #42' : ''}
      </span>
      {badges}
    </div>
  );
}

/** #15 and #45. The trail is named. The stored prompt is not drawn. */
export function ProvenanceFooter({ entity }: { entity: Entity }) {
  const proposal = promotingProposal(entity.promotedFrom);

  return (
    <p className="text-[0.7rem] text-muted-foreground">
      Promoted from proposal <code>{entity.promotedFrom}</code> (#15)
      {proposal === undefined
        ? ', which the sample does not carry'
        : `, decided ${proposal.decidedAt ?? 'not yet'} by ${proposal.decidedBy ?? 'nobody'}`}
      . The stored rendered prompt of that call is not shown: it holds retrieved source text and #45
      is open.
    </p>
  );
}

/** The prototype has no navigation, so an unknown identifier lists what exists. */
export function PrototypeIndex({ search }: { search: string }) {
  return (
    <div className="space-y-2 p-2">
      <h1 className="text-base font-medium">No entity carries this identifier</h1>
      <p className="text-xs text-muted-foreground">
        The sample of #46 holds five. The last one is the density probe of this prototype: 120
        claims and 30 documents, invented to measure the screen.
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
