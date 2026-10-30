import { ui } from './content';
import { NodeRef } from './node-ref';
import { reportGraph } from './report-graph';

/** Every node of the report, grouped by layer and in the rank order of its layer. */
export function NodeIndex() {
  return (
    <section id="nodes" aria-labelledby="nodes-title" className="border-t border-border pt-6 pb-24">
      <h2 id="nodes-title" className="text-heading text-balance md:text-heading-lg">
        {ui.index.title}
      </h2>
      <div className="mt-8 grid gap-8 md:grid-cols-3">
        {ui.index.layers.map((layer) => {
          const nodes = reportGraph.layer(layer);
          return (
            <section key={layer} aria-labelledby={`nodes-${layer}`}>
              <h3 id={`nodes-${layer}`} className="font-mono text-caption uppercase text-label">
                {layer} · <span className="tabular-nums">{nodes.length}</span>
              </h3>
              <ol className="mt-3 text-body-sm">
                {nodes.map((node) => (
                  <li
                    key={node.node_id}
                    className="flex min-h-11 items-center justify-between gap-3 border-b border-divider"
                  >
                    <NodeRef id={node.node_id}>{node.name}</NodeRef>
                    <span className="shrink-0 font-mono text-data text-label">{node.type}</span>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </section>
  );
}
