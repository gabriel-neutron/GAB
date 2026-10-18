import type { CriticalNode, NodeCondition } from '@gab/release/site-release';

import { DataTable, type DataColumn } from '@/shared/page/data-table';
import { PageHeader } from '@/shared/page/page-header';
import { PageSection } from '@/shared/page/page-section';
import { READING_LINK } from '@/shared/page/reading-link';
import { ReadingPage } from '@/shared/page/reading-page';
import { releaseDay } from '@gab/release/release-day';

import { groupNodes } from './nodes';

export interface NodesPageProps {
  /** Null when the site holds no release: the table comes from a release and from nothing else. */
  readonly release: {
    /** The day of the release, YYYY-MM-DD. */
    readonly date: string;
    readonly nodes: readonly CriticalNode[];
    /** What each claim of a tick says, by claim identifier. */
    readonly claimTexts: Readonly<Record<string, string>>;
  } | null;
  /** The address of the page of one entity. */
  readonly entityHref: (id: string) => string;
}

const CONDITIONS = [
  { key: 'a', words: '(a) Sanctions exposure' },
  { key: 'b', words: '(b) Production or throughput' },
  { key: 'c', words: '(c) Bypass routing' },
] as const;

// The word is the mark: "not sourced" also takes the dissent hue, and never the hue alone.
function ConditionCell({
  condition,
  claimTexts,
}: {
  readonly condition: NodeCondition | undefined;
  readonly claimTexts: Readonly<Record<string, string>>;
}) {
  if (condition === undefined) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className={condition.state === 'not sourced' ? 'text-dissent' : undefined}>
        {condition.state}
      </p>
      {condition.claimIds.map((id) => (
        <p key={id}>{claimTexts[id] ?? id}</p>
      ))}
    </div>
  );
}

const columnsOf = (
  entityHref: NodesPageProps['entityHref'],
  claimTexts: Readonly<Record<string, string>>,
): readonly DataColumn<CriticalNode>[] => [
  {
    key: 'node',
    header: 'Node',
    cell: (node) => (
      <>
        <a className={READING_LINK} href={entityHref(node.id)}>
          {node.label}
        </a>
        <p className="font-normal text-muted-foreground">{node.type}</p>
      </>
    ),
  },
  ...CONDITIONS.map(({ key, words }) => ({
    key,
    header: words,
    cell: (node: CriticalNode) => (
      <ConditionCell
        condition={node.conditions.find((one) => one.key === key)}
        claimTexts={claimTexts}
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
export function NodesPage({ release, entityHref }: NodesPageProps) {
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
  const columns = columnsOf(entityHref, release.claimTexts);
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
