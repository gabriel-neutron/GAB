import { EntityGlyph } from '@/shared/entity-glyph';

// The method diagram of the report: three layers, the two paths of the money, and the three conditions
// of a critical node. The figure numbers stay out of the image.
// Each layer takes the hue and the glyph of the entity type it is about (port, military unit, bank).
const cards = [
  {
    name: 'Pay',
    type: 'port',
    x: 200,
    y: 0,
    items: [
      'Oil and gas ports and pipelines',
      'Tankers, including sanctioned ships',
      'Buyer countries',
    ],
  },
  {
    name: 'Fight',
    type: 'military-unit',
    x: 0,
    y: 250,
    items: [
      'Dual-use and critical goods',
      'From component to factory',
      'Defence plants under sanctions',
    ],
  },
  {
    name: 'Finance',
    type: 'bank',
    x: 400,
    y: 250,
    items: ['Banks, Russian and foreign', 'Payment agents and SPFS', 'Crypto and stablecoins'],
  },
] as const;
const conditions = ['Under sanctions', 'Active 2024–2026', 'Via a third country'] as const;
const W = 240,
  H = 124;

export function MethodDiagram() {
  return (
    <figure className="method-diagram">
      <svg
        viewBox="0 0 640 374"
        role="img"
        aria-label="Method diagram: three layers, two paths, three conditions"
      >
        <defs>
          <marker
            id="method-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
          >
            <path d="M0 0L8 4L0 8Z" className="method-head" />
          </marker>
        </defs>
        {cards.map((c) => (
          <g key={c.name} transform={`translate(${c.x},${c.y})`}>
            <rect width={W} height={H} className="method-card" />
            <rect width={W} height="3" style={{ fill: `var(--entity-${c.type})` }} />
            <svg x="16" y="21" width="16" height="16">
              <EntityGlyph type={c.type} size={16} />
            </svg>
            <text
              x="40"
              y="35"
              className="method-title"
              style={{ fill: `var(--entity-${c.type})` }}
            >
              {c.name}
            </text>
            {c.items.map((item, i) => (
              <text key={item} x="16" y={66 + i * 20} className="method-item">
                {item}
              </text>
            ))}
          </g>
        ))}
        <path d="M250 126L150 246" className="method-link" markerEnd="url(#method-arrow)" />
        <text x="190" y="176" textAnchor="end" className="method-label">
          Budget path
        </text>
        <text x="182" y="194" textAnchor="end" className="method-note">
          Taxes fund arms orders
        </text>
        <path d="M390 126L490 246" className="method-link dashed" markerEnd="url(#method-arrow)" />
        <text x="450" y="176" className="method-label">
          Currency path
        </text>
        <text x="458" y="194" className="method-note">
          Export earnings
        </text>
        <path d="M398 312H244" className="method-link dashed" markerEnd="url(#method-arrow)" />
        <text x="320" y="300" textAnchor="middle" className="method-note">
          Pays for imports
        </text>
        {/* The critical node: the one bright card (FigureCard), the three conditions as rings, their
            meeting point as the one chromatic mark. */}
        <g transform="translate(456,0)">
          <rect width="184" height={H} className="method-figure" />
          <text x="14" y="24" className="method-label on-figure">
            Critical node
          </text>
          <text x="14" y="40" className="method-label on-figure">
            All three
          </text>
          {[
            [156, 20],
            [148, 33],
            [164, 33],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="11" className="method-ring" />
          ))}
          <circle cx="156" cy="29" r="3.5" className="method-core" />
          {conditions.map((c, i) => (
            <g key={c} transform={`translate(14,${68 + i * 22})`}>
              <line x2="156" y1="-16" y2="-16" className="method-rule" />
              <text className="method-label on-figure">{i + 1}</text>
              <text x="16" className="method-item on-figure">
                {c}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </figure>
  );
}
