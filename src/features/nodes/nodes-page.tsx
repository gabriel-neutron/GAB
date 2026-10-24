import { Link } from '@tanstack/react-router';
import type { SiteManifest } from '@gab/release/site-manifest';
import type { CriticalNode, NodeCondition, PairRating } from '@gab/release/site-release';

import { DataTable, type DataColumn } from '@/shared/page/data-table';
import { ClaimLink } from '@/shared/page/claim-link';
import { CoverageStatement } from '@/shared/page/coverage-statement';
import { DisclaimerText } from '@/shared/page/disclaimer-text';
import { PageHeader } from '@/shared/page/page-header';
import { PageSection } from '@/shared/page/page-section';
import { READING_LINK } from '@/shared/page/reading-link';
import { ReadingPage } from '@/shared/page/reading-page';
import { typeLabel } from '@/shared/type-label';
import { releaseDay } from '@gab/release/release-day';

import { groupNodes, withoutNodeName } from './nodes';

export interface TickClaim {
  readonly text: string;
  readonly rating: PairRating;
}

export interface NodesPageProps {
  /** Null when the site holds no release: the table comes from a release and from nothing else. */
  readonly release: {
    /** The manifest of the release: its day, its counts and the words of its labels. */
    readonly manifest: SiteManifest;
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
  { key: 'a', words: 'Sanctions' },
  { key: 'b', words: 'Production' },
  { key: 'c', words: 'Bypass routing' },
] as const;

// The word is the mark: "not sourced" also takes the dissent hue, and never the hue alone.
function ConditionCell({
  label,
  condition,
  claims,
  claimHref,
}: {
  /** The node of the row. A claim that starts with its name does not repeat it. */
  readonly label: string;
  readonly condition: NodeCondition | undefined;
  readonly claims: Readonly<Record<string, TickClaim>>;
  readonly claimHref: NodesPageProps['claimHref'];
}) {
  if (condition === undefined) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {condition.state === 'not sourced' || condition.claimIds.length === 0 ? (
        <p className={condition.state === 'not sourced' ? 'text-dissent' : undefined}>
          {condition.state}
        </p>
      ) : null}
      {condition.claimIds.map((id) => {
        const claim = claims[id];
        return (
          <p key={id}>
            {claim === undefined ? (
              id
            ) : (
              <ClaimLink
                text={withoutNodeName(claim.text, label)}
                href={claimHref(id)}
                rating={claim.rating}
              />
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
          <p className="font-normal">
            <span className="inline-block border border-border px-1 text-small/4 text-muted-foreground">
              {typeLabel(node.type)}
            </span>
          </p>
          {imo === undefined ? null : (
            <p className="font-normal">
              <a
                className={READING_LINK}
                href={vesselHref(imo)}
                aria-label={`Timeline of IMO ${imo}`}
              >
                Timeline
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
        label={node.label}
        condition={node.conditions.find((one) => one.key === key)}
        claims={claims}
        claimHref={claimHref}
      />
    ),
  })),
  {
    key: 'ticks',
    header: 'Conditions met',
    figure: 'count',
    cell: (node) => `${String(node.sourcedTicks)} of ${String(CONDITIONS.length)}`,
  },
  { key: 'controller', header: 'Controller', cell: (node) => node.controller },
  { key: 'bypass', header: 'Bypass pattern', cell: (node) => node.bypassPattern },
];

const PROSE = 'max-w-prose';

/** The front page of a release: what it holds, the meaning of each label, and the critical nodes
 * table, on the reading scale: the retained nodes first, then the other candidates. Each
 * condition gives its word and the claims of its tick. A release with no candidate node still
 * gives the counts and the labels, because those are what a reader needs first. */
export function NodesPage({ release, entityHref, vesselHref, claimHref }: NodesPageProps) {
  if (release === null)
    return (
      <ReadingPage>
        <PageHeader title="GAB dataset" />
        <p className="text-muted-foreground">
          This site holds no release, and the front page comes from a release.
        </p>
      </ReadingPage>
    );
  const { retained, others, summary } = groupNodes(release.nodes);
  const columns = columnsOf(
    { entityHref, vesselHref, imoOf: release.imoOf, claimHref },
    release.claims,
  );
  const { manifest } = release;
  return (
    <ReadingPage>
      <PageHeader title="GAB dataset" detail={`From the release of ${releaseDay(manifest.date)}`} />
      <p className={PROSE}>
        Each claim of this release cites the documents that state it, and carries a label that tells
        who decided it. A claim tells what its sources say, and a source can be wrong.{' '}
        <Link to="/graph" search={{ entity: '', relation: '' }} className={READING_LINK}>
          Open the graph
        </Link>
        ,{' '}
        <Link to="/map" search={{ entity: '' }} className={READING_LINK}>
          the map
        </Link>{' '}
        or{' '}
        <Link to="/search" className={READING_LINK}>
          the search
        </Link>
        , or{' '}
        <Link to="/downloads" className={READING_LINK}>
          download the files
        </Link>
        .
      </p>

      {manifest.coverage === null ? null : (
        <PageSection title="What this release holds">
          <CoverageStatement
            coverage={manifest.coverage}
            release={{ version: manifest.version, date: manifest.date }}
          />
        </PageSection>
      )}

      <PageSection title="The labels">
        <DisclaimerText markdown={manifest.disclaimer} />
      </PageSection>

      <PageSection title="Critical nodes">
        <p className={PROSE}>
          A node is retained when two of the three conditions have a public source: sanctions,
          production or throughput in 2024-2026, and bypass routing.
        </p>
        <p>{summary}</p>
        {retained.length === 0 ? null : (
          <DataTable
            name="Retained nodes"
            columns={columns}
            rows={retained.map((row) => ({ id: row.id, row }))}
            empty=""
          />
        )}
        {others.length === 0 ? null : (
          <DataTable
            name="Other candidate nodes"
            columns={columns}
            rows={others.map((row) => ({ id: row.id, row }))}
            empty=""
          />
        )}
      </PageSection>
    </ReadingPage>
  );
}
