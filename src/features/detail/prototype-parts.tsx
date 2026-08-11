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
  attributeEntries,
  claimsCiting,
  findDocument,
  promotingProposal,
  relationInterval,
  relationSentence,
  type AttributeEntry,
} from './prototype-data';

/* -------------------------------------------------------------------------- the source badge */

/**
 * The badge is the number alone. The score and its origin live in the rail on the right, once
 * per document.
 *
 * **This is a finding for #12, decided by the operator on 11 August 2026.** PU1 asks for the
 * origin and the score of every candidate claim to be visible and non-bypassable. With a bare
 * number, both are one click away, and the claim line carries a pointer instead of a label.
 * The tooltip names the document and its score, and a tooltip is not a label. #12 must say
 * whether a pointer satisfies the obligation.
 */
function badgeTitle(docId: DocId): string {
  const document = findDocument(docId);
  if (document === undefined) return `${docId} — no row in documents`;
  const score =
    document.admiralty === null
      ? 'not rated'
      : `${document.admiralty}, origin ${document.admiraltyOrigin ?? ''}`;
  return `${document.title} — ${score}`;
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
          title={badgeTitle(id)}
          className={`flex h-5 min-w-6 items-center justify-center rounded border px-1 font-mono text-[0.7rem] transition-colors hover:bg-muted ${
            active === id ? 'border-foreground bg-muted' : 'border-border'
          }`}
        >
          {sourceNumber(order, id)}
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
          <Popover.Trigger
            title={badgeTitle(id)}
            className="flex h-5 min-w-6 items-center justify-center rounded border border-border px-1 font-mono text-[0.7rem] transition-colors hover:bg-muted"
          >
            {sourceNumber(order, id)}
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
 * **One size for every field.** A hundred boxes of six different widths read as noise, and the
 * eye cannot use the left edge of the value as a guide. Every control is now the same box, and a
 * list, a date and a number all sit inside it.
 */
const FIELD =
  'h-6 w-full rounded-none border-transparent bg-muted/60 px-1.5 py-0 text-xs ' +
  'disabled:cursor-default disabled:bg-muted/60 disabled:text-foreground disabled:opacity-100 ' +
  'dark:bg-input/40 dark:disabled:bg-input/40';

/**
 * UC1. The control is chosen from the value, because nothing in the model declares a type
 * (reported to #46), and it is disabled, because the write path is a promotion and #42 is open.
 *
 * A list is joined into the one box. It kept its own boxes until the density probe showed what
 * three ragged chips do to a column of a hundred rows.
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
  const label = keyToLabel(attributeKey);

  if (shape.kind === 'boolean') {
    return (
      <span className={`${FIELD} flex items-center`}>
        <input
          id={id}
          type="checkbox"
          checked={shape.value}
          readOnly
          disabled
          aria-label={label}
          className="size-3.5 accent-foreground opacity-100"
        />
      </span>
    );
  }

  const text = shape.kind === 'list' ? shape.value.join(', ') : String(shape.value);
  const type = shape.kind === 'number' ? 'number' : shape.kind === 'date' ? 'date' : 'text';

  return (
    <Input
      id={id}
      type={type}
      value={text}
      readOnly
      disabled
      aria-label={label}
      title={text}
      className={FIELD}
    />
  );
}

/**
 * **The model carries no group and no order.** `attrs` is one flat object, so a hundred claims
 * arrive as a hundred keys in whatever order the store returns. The table below invents the
 * groups from the name of the key.
 *
 * **This is a guess, and it is a finding for #46.** A real screen needs the group, the unit and
 * the type to arrive with the attribute, not to be recovered from its name by a regular
 * expression. What follows is what a design must do until they do.
 */
const GROUP_RULES: readonly (readonly [RegExp, string])[] = [
  [
    /^(imo|mmsi|call_sign|vessel_|former_names|flag_state|port_of_registry|official_|hull_number|keel_|delivered_)/,
    'Identity',
  ],
  [
    /^(length_|beam_|depth_|summer_|gross_|net_tonnage|deadweight|lightship|grain_|bale_|holds_|hatches_)/,
    'Dimensions',
  ],
  [
    /^(engine_|propellers|bunker_|service_speed|maximum_speed|daily_consumption|auxiliary_)/,
    'Machinery',
  ],
  [
    /^(class_|ice_class|last_special|next_special|last_drydock|next_drydock|last_annual|condition_|psc_|last_psc)/,
    'Class and survey',
  ],
  [
    /^(cranes|crane_|scrubber|ballast_water|eedi|carbon_intensity|imo_number_marked|safety_management|ship_security|maritime_labour)/,
    'Certificates',
  ],
  [
    /^(registered_owner|beneficial_owner|ism_|commercial_|technical_|operator_|group_|ownership_|purchase_|mortgage_|protection_and|hull_and|insured_)/,
    'Ownership',
  ],
  [
    /^(last_port|next_declared|estimated_arrival|current_cargo|cargo_|laden_|reported_|ais_|longest_ais)/,
    'Movement',
  ],
  [
    /^(sanctions|flag_changes|name_changes|ship_to_ship|dark_|high_risk|detention|casualty|crew_)/,
    'Risk',
  ],
  [/_note$/, 'Analyst notes'],
];

/** The order of the groups is the order of the rules, never the order the keys arrived in. */
const GROUP_ORDER: readonly string[] = [...GROUP_RULES.map(([, label]) => label), 'Other'];

export interface ClaimGroup {
  readonly label: string;
  readonly entries: readonly AttributeEntry[];
}

export function groupClaims(entity: Entity): ClaimGroup[] {
  const groups = new Map<string, AttributeEntry[]>();

  attributeEntries(entity.attrs).forEach((entry) => {
    const rule = GROUP_RULES.find(([pattern]) => pattern.test(entry[0]));
    const label = rule?.[1] ?? 'Other';
    const bucket = groups.get(label);
    if (bucket === undefined) groups.set(label, [entry]);
    else bucket.push(entry);
  });

  return [...groups]
    .map(([label, entries]) => ({ label, entries }))
    .sort((left, right) => GROUP_ORDER.indexOf(left.label) - GROUP_ORDER.indexOf(right.label));
}

/**
 * **One claim is one cell, and the cell decides how wide it is.**
 *
 * The operator asked for the data to fall on one line or on several, by itself. A hundred claims
 * are not a hundred rows of the same shape: `holds count 7` needs a sixth of the width that a
 * note needs. So the claims flow, and each one takes a width from the value it carries — four
 * short ones to a line, one long one alone. In a 24 rem sidebar the same rule puts one on each
 * line, with no second layout to maintain.
 */
function cellWidth(attribute: Attribute): string {
  const shape = shapeOf(attribute.v);
  if (shape.kind === 'boolean') return 'basis-[15rem]';

  const length = shape.kind === 'list' ? shape.value.join(', ').length : String(shape.value).length;
  if (length <= 12) return 'basis-[15rem]';
  if (length <= 34) return 'basis-[23rem]';
  return 'basis-full';
}

export function ClaimCell({
  attributeKey,
  attribute,
  badges,
  compact,
}: {
  attributeKey: string;
  attribute: Attribute;
  badges: ReactNode;
  /** The sidebar is 24 rem wide, so the name gives some of its width back to the value. */
  compact: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 grow items-center gap-2 border-b border-border/60 py-0.5 ${cellWidth(attribute)}`}
    >
      <span
        className={`shrink-0 truncate text-xs text-muted-foreground ${compact ? 'w-24' : 'w-36'}`}
        title={keyToLabel(attributeKey)}
      >
        {keyToLabel(attributeKey)}
      </span>
      <span className="min-w-0 flex-1">
        <ValueControl attributeKey={attributeKey} attribute={attribute} />
      </span>
      {badges}
    </div>
  );
}

/**
 * The claims, in named groups, flowing. The group is what tells the reader that `beam moulded m`
 * is a dimension and not a certificate, so no row has to say it.
 */
export function GroupedClaims({
  entity,
  badges,
  compact,
}: {
  entity: Entity;
  badges: (ids: readonly DocId[]) => ReactNode;
  compact: boolean;
}) {
  return (
    <div>
      {groupClaims(entity).map((group) => (
        <section key={group.label} className="pb-3">
          <h3 className="sticky top-0 z-10 flex items-baseline gap-2 bg-background pt-2 pb-1 text-[0.7rem] font-medium tracking-widest uppercase">
            {group.label}
            <span className="font-mono text-muted-foreground">{group.entries.length}</span>
            <span className="h-px flex-1 bg-border" />
          </h3>
          <div className="flex flex-wrap gap-x-6">
            {group.entries.map(([key, attribute]) => (
              <ClaimCell
                key={key}
                attributeKey={key}
                attribute={attribute}
                badges={badges(attribute.src)}
                compact={compact}
              />
            ))}
          </div>
        </section>
      ))}
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
        {/* The score **and** the origin of the score, because PU1 asks for both to be visible
            (#12). Two words is the whole cost, and the origin is the half a reader argues with. */}
        <span className="shrink-0">
          <span className="font-mono">{rated ? document.admiralty : 'not rated'}</span>
          <span className="text-muted-foreground">
            {' · '}
            {rated ? document.admiraltyOrigin : 'no origin'}
          </span>
        </span>
      </div>

      <div className="flex items-baseline gap-3 pt-0.5">
        <span className="min-w-0 flex-1 truncate">
          {document.uri === null ? (
            <span className="text-muted-foreground">no address — the file entered as a scan</span>
          ) : (
            <a
              className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
              href={document.uri}
              title={document.uri}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open the source ↗ <span className="font-normal">{shortAddress(document.uri)}</span>
            </a>
          )}
        </span>
        <span className="shrink-0 text-muted-foreground">{document.retrievedAt ?? 'no date'}</span>
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
          }}
          aria-expanded={open}
          className="shrink-0 text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          {open ? 'Hide' : 'What it holds up'} ({claims.length})
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
                className="text-primary underline decoration-primary/40 underline-offset-2"
                href={document.archiveUri}
                target="_blank"
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
 * The name and the type. **Nothing else.**
 *
 * The identifier and the point were here and they are gone: a UUID is not read by eye, and the
 * analyst arrived from the map or from the graph, so he knows where the thing is. An entity with
 * no geometry says nothing either — it is the map that cannot show it, not this screen.
 */
export function EntityHeading({ entity }: { entity: Entity }) {
  return (
    <div className="flex items-baseline gap-2 pb-1">
      <h1 className="truncate text-base font-medium">{entity.label}</h1>
      <Badge variant="secondary" className="h-4 shrink-0 font-normal">
        {entity.type}
      </Badge>
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
        The sample of #46 holds five. The last four are the density probe of this prototype: 100
        claims and 14 documents, invented to measure the screen.
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
