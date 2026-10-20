import type { CriticalNode, NodeCondition, PairRating } from '@gab/release/site-release';

import { DataTable, type DataColumn } from '@/shared/page/data-table';
import { AdmiraltyLegend } from '@/shared/page/admiralty-legend';
import { ClaimLink } from '@/shared/page/claim-link';
import { PageHeader } from '@/shared/page/page-header';
import { PageSection } from '@/shared/page/page-section';
import { READING_LINK } from '@/shared/page/reading-link';
import { ReadingPage } from '@/shared/page/reading-page';
import { typeLabel } from '@/shared/type-label';
import { releaseDay } from '@gab/release/release-day';

import { groupNodes } from './nodes';

export interface TickClaim {
  readonly text: string;
  readonly rating: PairRating;
}

export interface NodesPageProps {
  /** Null when the site holds no release: the table comes from a release and from nothing else. */
  readonly release: {
    /** The day of the release, YYYY-MM-DD. */
    readonly date: string;
    readonly nodes: readonly CriticalNode[];
    /** What each claim of a tick says, and its ADMIRALTY rating, by claim identifier. */
    readonly claims: Readonly<Record<string, TickClaim>>;
    /** The IMO number of each node that is a vessel with one, by node identifier. */
    readonly imoOf: Readonly<Record<string, string>>;
  } | null;
  /** The address of the page of one entity. */
  readonly entityHref: (id: string) => string;
  /** The address of the timeline of the vessels with one IMO number. */
  readonly vesselHref: (imo: string) => string;
  /** The address of the page of one claim. */
  readonly claimHref: (id: string) => string;
}

const CONDITIONS = [
  { key: 'a', words: '(a) Sanctions exposure' },
  { key: 'b', words: '(b) Production or throughput' },
  { key: 'c', words: '(c) Bypass routing' },
] as const;

// The word is the mark: "not sourced" also takes the dissent hue, and never the hue alone.
function ConditionCell({
  condition,
  claims,
  claimHref,
}: {
  readonly condition: NodeCondition | undefined;
  readonly claims: Readonly<Record<string, TickClaim>>;
  readonly claimHref: NodesPageProps['claimHref'];
}) {
  if (condition === undefined) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className={condition.state === 'not sourced' ? 'text-dissent' : undefined}>
        {condition.state}
      </p>
      {condition.claimIds.map((id) => {
        const claim = claims[id];
        return (
          <p key={id}>
            {claim === undefined ? (
              id
            ) : (
              <ClaimLink text={claim.text} href={claimHref(id)} rating={claim.rating} />
            )}
          </p>
        );
      })}
    </div>
  );
}

interface Links {
  readonly entityHref: NodesPageProps['entityHref'];
  readonly vesselHref: NodesPageProps['vesselHref'];
  readonly imoOf: Readonly<Record<string, string>>;
  readonly claimHref: NodesPageProps['claimHref'];
}

const columnsOf = (
  { entityHref, vesselHref, imoOf, claimHref }: Links,
  claims: Readonly<Record<string, TickClaim>>,
): readonly DataColumn<CriticalNode>[] => [
  {
    key: 'node',
    header: 'Node',
    cell: (node) => {
      const imo = imoOf[node.id];
      return (
        <>
          <a className={READING_LINK} href={entityHref(node.id)}>
            {node.label}
          </a>
          <p className="font-normal text-muted-foreground">{typeLabel(node.type)}</p>
          {imo === undefined ? null : (
            <p className="font-normal">
              <a className={READING_LINK} href={vesselHref(imo)}>
                {`Timeline of IMO ${imo}`}
              </a>
            </p>
          )}
        </>
      );
    },
  },
  ...CONDITIONS.map(({ key, words }) => ({
    key,
    header: words,
    cell: (node: CriticalNode) => (
      <ConditionCell
        condition={node.conditions.find((one) => one.key === key)}
        claims={claims}
        claimHref={claimHref}
      />
    ),
  })),
  {
    key: 'ticks',
    header: 'Ticks',
    figure: 'count',
    cell: (node) => `${String(node.ticks)} (${String(node.sourcedTicks)} sourced)`,
  },
  { key: 'controller', header: 'Controller', cell: (node) => node.controller },
  { key: 'bypass', header: 'Bypass pattern', cell: (node) => node.bypassPattern },
];

/** The critical nodes table of a release, on the reading scale: the retained nodes first, then
 * the other candidates. Each condition gives its word and the claims of its tick. */
export function NodesPage({ release, entityHref, vesselHref, claimHref }: NodesPageProps) {
  if (release === null)
    return (
      <ReadingPage>
        <PageHeader title="Critical nodes" />
        <p className="text-muted-foreground">
          This site holds no release, and the critical nodes table comes from a release.
        </p>
      </ReadingPage>
    );
  const { retained, others, summary } = groupNodes(release.nodes);
  const columns = columnsOf(
    { entityHref, vesselHref, imoOf: release.imoOf, claimHref },
    release.claims,
  );
  return (
    <ReadingPage>
      <PageHeader
        title="Critical nodes"
        detail={`From the release of ${releaseDay(release.date)}`}
      />
      <p className="max-w-prose">
        A node is retained when two conditions of three have a sourced tick: (a) documented
        sanctions exposure, (b) documented production or throughput in 2024-2026, (c) presence in a
        bypass routing across jurisdictions. Condition (a) comes from the public designations of the
        node in the record. The operator ticks (b) and (c) with the claims that support each tick. A
        tick with no public claim shows "not sourced", and it does not count.
      </p>
      <p>{summary}</p>
      <AdmiraltyLegend shown={Object.values(release.claims).some((one) => one.rating.shown)} />
      {retained.length === 0 ? null : (
        <PageSection title="Retained nodes">
          <DataTable
            name="Retained nodes"
            columns={columns}
            rows={retained.map((row) => ({ id: row.id, row }))}
            empty=""
          />
        </PageSection>
      )}
      {others.length === 0 ? null : (
        <PageSection title="Other candidate nodes">
          <DataTable
            name="Other candidate nodes"
            columns={columns}
            rows={others.map((row) => ({ id: row.id, row }))}
            empty=""
          />
        </PageSection>
      )}
    </ReadingPage>
  );
}
