import { EntityGlyph } from '@/shared/entity-glyph';
import { ui } from './content';
import { reportGraph } from './report-graph';

const RADIUS = 92;

/** The node at the centre and its neighbours on a ring. A still picture: the list of relations
 * beside it holds the controls. */
export function LocalGraph({ id }: { readonly id: string }) {
  const node = reportGraph.node(id);
  if (node === undefined) return null;
  // A neighbour is a node of the report, or a shared entity that the relation names.
  const neighbours = [
    ...new Map(
      reportGraph.relations(id).map((edge) => {
        const outward = edge.source === id;
        const other = outward ? edge.target : edge.source;
        const found = reportGraph.node(other);
        const layer = outward ? edge.target_layer : edge.source_layer;
        return [
          other,
          {
            node_id: other,
            short_label: found?.short_label ?? other,
            glyph: reportGraph.glyph(found?.type ?? layer.replace('shared entity: ', '')),
          },
        ] as const;
      }),
    ).values(),
  ];
  const place = (index: number): readonly [number, number] => {
    const angle = (index / Math.max(neighbours.length, 1)) * 2 * Math.PI - Math.PI / 2;
    return [Math.cos(angle) * RADIUS, Math.sin(angle) * RADIUS];
  };
  return (
    <svg
      role="img"
      aria-label={`${ui.panel.neighboursLabel}: ${node.short_label}`}
      viewBox="-200 -125 400 250"
      className="w-full"
    >
      {neighbours.map((other, index) => {
        const [x, y] = place(index);
        return (
          <line
            key={`line-${other.node_id}`}
            x1={0}
            y1={0}
            x2={x}
            y2={y}
            stroke="var(--chart-axis)"
            strokeWidth={1}
          />
        );
      })}
      {[
        {
          node_id: node.node_id,
          short_label: node.short_label,
          glyph: reportGraph.glyph(node.type),
        },
        ...neighbours,
      ].map((one, index) => {
        const [x, y] = index === 0 ? [0, 0] : place(index - 1);
        return (
          <g key={one.node_id} transform={`translate(${x},${y})`}>
            <circle r={11} fill="var(--surface)" />
            <g transform="translate(-7,-7)">
              <EntityGlyph type={one.glyph} size={14} />
            </g>
            <text
              y={index > 0 && y < 1 ? -16 : 22}
              textAnchor="middle"
              fill={index === 0 ? 'var(--foreground)' : 'var(--muted-foreground)'}
              className="font-mono text-report-label"
            >
              {one.short_label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
