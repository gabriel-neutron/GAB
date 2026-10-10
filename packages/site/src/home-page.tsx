import { ClaimLink } from './claim-link.tsx';
import { SiteFrame } from './site-frame.tsx';
import { CELL, HEAD, LINK, TABLE, TABLE_HEAD } from './site-style.ts';
import { entityPage, HOME, hrefFrom } from './site-paths.ts';
import type { CriticalNode, NodeCondition, SiteRelease } from './site-release.ts';

const CONDITIONS = [
  { key: 'a', words: '(a) Sanctions exposure' },
  { key: 'b', words: '(b) Production or throughput' },
  { key: 'c', words: '(c) Bypass routing' },
] as const;

function ConditionCell({
  release,
  condition,
}: {
  readonly release: SiteRelease;
  readonly condition: NodeCondition | undefined;
}) {
  if (condition === undefined) return <td className={CELL} />;
  return (
    <td className={CELL}>
      <p className={condition.state === 'not sourced' ? 'text-dissent' : undefined}>
        {condition.state}
      </p>
      {condition.claimIds.length === 0 ? null : (
        <ul className="flex flex-col gap-0.5">
          {condition.claimIds.map((id) => {
            const claim = release.claimById.get(id);
            return (
              <li key={id}>
                {claim === undefined ? (
                  <span className="font-mono">{id}</span>
                ) : (
                  <ClaimLink claim={claim} here={HOME} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </td>
  );
}

function NodeTable({
  release,
  nodes,
  caption,
}: {
  readonly release: SiteRelease;
  readonly nodes: readonly CriticalNode[];
  readonly caption: string;
}) {
  if (nodes.length === 0) return null;
  return (
    <div className="max-w-full overflow-x-auto">
      <table className={TABLE}>
        <caption className="pb-1 text-left font-medium">{caption}</caption>
        <thead className={TABLE_HEAD}>
          <tr>
            <th className={HEAD}>Node</th>
            {CONDITIONS.map((one) => (
              <th key={one.key} className={HEAD}>
                {one.words}
              </th>
            ))}
            <th className={`${HEAD} text-right`}>Ticks</th>
            <th className={HEAD}>Controller</th>
            <th className={HEAD}>Bypass pattern</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => (
            <tr key={node.id} className="border-b border-border">
              <td className={CELL}>
                <a className={LINK} href={hrefFrom(HOME, entityPage(node.id))}>
                  {node.label}
                </a>
                <p className="text-muted-foreground">{node.type}</p>
              </td>
              {CONDITIONS.map((one) => (
                <ConditionCell
                  key={one.key}
                  release={release}
                  condition={node.conditions.find((condition) => condition.key === one.key)}
                />
              ))}
              <td className={`${CELL} text-right font-mono tabular-nums`}>
                {node.ticks} ({node.sourcedTicks} sourced)
              </td>
              <td className={CELL}>{node.controller}</td>
              <td className={CELL}>{node.bypassPattern}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The home page of the site: the critical nodes table of the release, the retained nodes
 * first. Each condition gives its word and the claims of its tick. */
export function HomePage({ release }: { readonly release: SiteRelease }) {
  const nodes = release.criticalNodes;
  const retained = nodes.filter((one) => one.retained);
  const others = nodes.filter((one) => !one.retained);
  return (
    <SiteFrame release={release} page={{ path: HOME, title: 'Critical nodes' }}>
      <p className="max-w-prose">
        A node is retained when it meets two conditions of three: (a) documented sanctions exposure,
        (b) documented production or throughput in 2024-2026, (c) presence in a bypass routing
        across jurisdictions. Condition (a) comes from the public designations of the node in the
        record. The operator ticks (b) and (c) with the claims that support each tick. A tick with
        no public claim shows "not sourced".
      </p>
      <p>
        {nodes.length === 0
          ? 'This release has no candidate node.'
          : `${String(nodes.length)} candidate nodes, ${String(retained.length)} retained.`}
      </p>
      <NodeTable release={release} nodes={retained} caption="Retained nodes" />
      <NodeTable release={release} nodes={others} caption="Other candidate nodes" />
    </SiteFrame>
  );
}
