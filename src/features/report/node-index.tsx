import type { CSSProperties } from 'react';
import { ui } from './content';
import { NodeRef } from './node-ref';
import { reportGraph } from './report-graph';

// The glyphs keep their shapes but lose their hues: one neutral ink, the accent on the active row.
const GLYPH = Object.fromEntries(
  [
    'bank',
    'company',
    'event',
    'facility',
    'legal-act',
    'military-unit',
    'person',
    'port',
    'state-body',
    'unknown',
    'vessel',
  ].map((type) => [`--entity-${type}`, 'var(--index-glyph)']),
) as CSSProperties;

/** Every node of the report, grouped by layer and in the rank order of its layer. Each layer
 * spans the full width as a list in columns: 2 from 768px, 3 from 1024px. */
export function NodeIndex() {
  return (
    <section id="nodes" aria-labelledby="nodes-title" className="border-t border-border pt-6 pb-24">
      <h2 id="nodes-title" className="text-report-heading text-balance ">
        {ui.index.title}
      </h2>
      <div className="mt-8 grid gap-12">
        {ui.index.layers.map((layer) => {
          const nodes = reportGraph.layer(layer);
          return (
            <section key={layer} aria-labelledby={`nodes-${layer}`}>
              <h3
                id={`nodes-${layer}`}
                className="font-mono text-report-label uppercase text-label"
              >
                {layer} · <span className="tabular-nums">{nodes.length}</span>
              </h3>
              <ol
                // An underline shows on hover or focus only; a long name hangs past its glyph.
                className="mt-3 gap-x-8 text-report-small md:columns-2 lg:columns-3 [&_button]:block [&_button]:pl-3.5 [&_button]:-indent-3.5 [&_button]:no-underline [&_button:focus-visible]:underline [&_button:hover]:underline"
              >
                {nodes.map((node) => (
                  <li
                    key={node.node_id}
                    style={GLYPH}
                    className="flex min-h-11 break-inside-avoid items-baseline justify-between gap-3 border-b border-divider py-2.5 [--index-glyph:var(--color-label)] focus-within:[--index-glyph:var(--color-signal)] hover:[--index-glyph:var(--color-signal)]"
                  >
                    <NodeRef id={node.node_id} side="right">
                      {node.name}
                    </NodeRef>
                    <span className="shrink-0 font-mono text-report-label text-label">
                      {node.type}
                    </span>
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
