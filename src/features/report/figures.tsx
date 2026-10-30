import type { ReactNode } from 'react';
import { EntityGlyph } from '@/shared/entity-glyph';
import { reportAddress, type OpenReportNode } from './report-context';
import { itemAt, type ReportNode, type ReportRelation } from './model';
import { useRef, useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import rows from './prices-data';
import rawNodes from './nodes-data';
import rawEdges from './edges-data';
import land from './basemap-data';
import { Citation } from './citations';

export const nodes: Record<string, ReportNode> = Object.fromEntries(
  rawNodes.map((n) => [
    n.node_id,
    {
      id: n.node_id,
      name: n.short_label,
      type: n.type === 'terminal' ? 'port' : n.type === 'pipeline' ? 'facility' : 'company',
      record: n.record_entity_id,
      lat: n.lat ? Number(n.lat) : null,
      lon: n.lon ? Number(n.lon) : null,
      basis: n.place_basis,
      source: n.place_source,
      description:
        n.type === 'terminal'
          ? 'An export location cited in the report’s infrastructure dataset.'
          : n.node_id === 'N-P026'
            ? 'Russian oil company designated by OFAC on 22 October 2025.'
            : n.node_id === 'N-P030'
              ? 'Russian oil company designated by OFAC on 22 October 2025.'
              : 'An infrastructure entity in the report’s working graph.',
    },
  ]),
);
Object.assign(nodes, {
  'baltic-system': {
    id: 'baltic-system',
    name: 'Baltic Pipeline System',
    type: 'facility',
    description: 'Operated by Transneft in the source graph.',
    docs: 'doc_41393ee9f6c3',
  },
  espo: {
    id: 'espo',
    name: 'Eastern Siberia–Pacific Ocean',
    type: 'facility',
    description: 'Oil pipeline operated by Transneft in the source graph.',
    docs: 'doc_ca97fe153574',
  },
  ofac: {
    id: 'ofac',
    name: 'OFAC',
    type: 'state-body',
    description: 'The U.S. Treasury office publishing the 22 October 2025 designations.',
  },
});
export const relations: ReportRelation[] = [
  ...rawEdges.map((e) => ({
    from: e.source,
    to:
      e.target === 'Baltic Pipeline System'
        ? 'baltic-system'
        : e.target === 'Eastern Siberia–Pacific Ocean Oil Pipeline'
          ? 'espo'
          : e.target,
    kind: e.relation_type,
    docs: e.document_ids,
    ref: 11,
  })),
  { from: 'N-P026', to: 'ofac', kind: 'designated by', ref: 8 },
  { from: 'N-P030', to: 'ofac', kind: 'designated by', ref: 8 },
];
export function Glyph({ type = 'company' }) {
  return <EntityGlyph type={type} className={`node-glyph glyph-${type}`} />;
}
export function nodeFor(id: string): ReportNode {
  const node = nodes[id];
  if (!node) throw new Error(`Unknown report node ${id}`);
  return node;
}
export function NodeLink({
  id,
  onOpen,
  children,
}: {
  id: string;
  onOpen: OpenReportNode;
  children?: ReactNode;
}) {
  const node = nodeFor(id);
  return (
    <a
      className="entity"
      href={reportAddress(`bibliography#node-${id}`)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onOpen(e.currentTarget, id);
      }}
    >
      <Glyph type={node.type} />
      {children ?? node.name}
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}
export function NodeRecord({ id = 'N-P026', titleId }: { id?: string; titleId?: string }) {
  const node = nodeFor(id);
  const links = relations.filter((r) => r.from === id || r.to === id);
  return (
    <>
      <p className="meta">
        <Glyph type={node.type} />
        {node.type.replace('-', ' ')} · Research extract
      </p>
      <h2 id={titleId}>{node.name}</h2>
      <p>{node.description}</p>
      {node.lat !== null && node.lat !== undefined && (
        <dl>
          <dt>Position</dt>
          <dd>
            {node.lat.toFixed(5)}° N, {node.lon?.toFixed(5)}° E
          </dd>
          <dt>Position basis</dt>
          <dd>
            {node.basis}
            <Citation id={10} />
          </dd>
          <dt>Recorded source</dt>
          <dd>{node.source}</dd>
        </dl>
      )}
      {links.length > 0 && (
        <>
          <h3>Documented relations</h3>
          <ul className="node-relations">
            {links.map((r, i) => (
              <li key={i}>
                {nodeFor(r.from).name} <span>{r.kind}</span> {nodeFor(r.to).name}
                <Citation id={r.ref} />
                {r.docs && <small>{r.docs}</small>}
              </li>
            ))}
          </ul>
        </>
      )}
      {node.docs && (
        <p className="data">
          {node.docs}
          <Citation id={11} />
        </p>
      )}
      {node.record && (
        <details>
          <summary>Record identifier</summary>
          <p className="record-id">{node.record}</p>
          <p>
            <a href={reportAddress(`entity/${encodeURIComponent(node.record)}`)}>
              Open GAB record ↗
            </a>
          </p>
          <p>
            <a href={reportAddress(`graph?entity=${encodeURIComponent(node.record)}`)}>
              Explore in the graph ↗
            </a>
          </p>
        </details>
      )}
      <p className="chart-note">
        Extracted from the report’s working data. The graph is not a complete inventory.
      </p>
    </>
  );
}
export function NodeDirectory() {
  return (
    <section className="node-directory">
      <h2>Entity records</h2>
      {Object.values(nodes).map((n) => (
        <article key={n.id} id={'node-' + n.id}>
          <NodeRecord id={n.id} />
          <a href={reportAddress('#network')}>Return to the report ↗</a>
        </article>
      ))}
    </section>
  );
}

const priceData = Array.from({ length: 46 }, (_, i) => {
  const date = new Date(Date.UTC(2022, 11 + i, 1)).toISOString().slice(0, 7);
  const find = (name: string) => {
    const value = rows.find((r) => r.series === name && r.period === date)?.value;
    return value ? Number(value) : null;
  };
  return {
    date,
    brent: find('Brent'),
    urals: find('Urals, Russian tax-base price'),
  };
});
export { priceData };
// print: the still state for the paper report; the caption, title and source go outside the image.
export function PriceFigure({ print = false }: { print?: boolean }) {
  const [selected, setSelected] = useState(45);
  const [visible, setVisible] = useState({ brent: true, urals: true, cap: true });
  const host = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      if (e) setWidth(Math.max(280, e.contentRect.width));
    });
    if (host.current) ro.observe(host.current);
    return () => ro.disconnect();
  }, []);
  const x = (i: number) => 40 + (i / 45) * (width - 64),
    y = (v: number) => 266 - (v / 125) * 230;
  const line = (key: 'brent' | 'urals') => {
    let d = '',
      last = -2;
    priceData.forEach((r, i) => {
      if (r[key] !== null) {
        d += `${last === i - 1 ? 'L' : 'M'}${x(i)},${y(r[key])} `;
        last = i;
      }
    });
    return d;
  };
  const current = itemAt(priceData, selected);
  const capPath = `M${x(4 / 31)},${y(60)}H${x(33 + 2 / 30)}V${y(47.6)}H${x(38)}V${y(44.1)}H${x(45)}`;
  const plot = (
    <>
      {[0, 25, 50, 75, 100, 125].map((v) => (
        <g key={v}>
          <line x1="40" x2={width - 24} y1={y(v)} y2={y(v)} className="plot-grid" />
          <text x="30" y={y(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {[1, 13, 25, 37].map((i) => (
        <text key={i} x={x(i)} y="294" textAnchor="middle">
          {itemAt(priceData, i).date.slice(0, 4)}
        </text>
      ))}
      {visible.brent && <path d={line('brent')} className="price-line brent" />}
      {visible.urals && (
        <>
          <path d={line('urals')} className="price-line urals" />
          {priceData.map((r, i) =>
            r.urals !== null ? (
              <circle key={i} cx={x(i)} cy={y(r.urals)} r="2" className="price-dot" />
            ) : null,
          )}
        </>
      )}
      {visible.cap && <path d={capPath} className="price-line cap" />}
      <line x1={x(34.7)} x2={x(34.7)} y1="36" y2="266" className="event-rule" />
    </>
  );
  if (print)
    return (
      <figure className="price-figure" ref={host}>
        <svg
          className="price-svg"
          viewBox={`0 0 ${width} 308`}
          role="img"
          aria-label="Monthly Brent and Urals prices, with the EU price cap."
        >
          {(
            [
              ['brent', 'Brent', 0],
              ['urals', 'Urals', 110],
              ['cap', 'EU price cap', 210],
            ] as const
          ).map(([key, label, dx]) => (
            <g key={key} transform={`translate(${40 + dx},12)`}>
              <line x2="20" className={`price-line ${key}`} />
              <text x="28" y="4">
                {label}
              </text>
            </g>
          ))}
          <text x={x(34.7) - 6} y="258" textAnchor="end">
            US designations of Rosneft and Lukoil
          </text>
          {plot}
        </svg>
      </figure>
    );
  return (
    <figure className="price-figure" ref={host}>
      <figcaption>
        <h3>Brent, Urals and the cap</h3>
        <p className="meta">
          Monthly averages · December 2022–September 2026 · US dollars / barrel <Citation id={3} />
          <Citation id={4} />
          <Citation id={7} />
        </p>
      </figcaption>
      <div className="chart-legend" aria-label="Visible price series">
        {(
          [
            ['brent', 'Brent'],
            ['urals', 'Urals · tax base'],
            ['cap', 'EU cap'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={visible[key]}
            onClick={() => setVisible((v) => ({ ...v, [key]: !v[key] }))}
          >
            <span className={'legend-mark ' + key} />
            {label}
          </button>
        ))}
      </div>
      <svg
        className="price-svg"
        viewBox={`0 0 ${width} 308`}
        role="img"
        aria-label="Monthly Brent and Urals prices, with the EU price cap. Eleven missing Urals months, December 2022 to November 2023, are not connected."
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setSelected(
            Math.max(
              0,
              Math.min(
                45,
                Math.round(((((e.clientX - r.left) * width) / r.width - 40) / (width - 64)) * 45),
              ),
            ),
          );
        }}
      >
        {plot}
        <line x1={x(selected)} x2={x(selected)} y1="36" y2="266" className="selection-rule" />
      </svg>
      <label className="month-control">
        <span>Inspect month</span>
        <input
          aria-label="Inspect price month"
          type="range"
          min="0"
          max="45"
          step="1"
          value={selected}
          onChange={(e) => setSelected(Number(e.target.value))}
        />
        <output>{current.date}</output>
      </label>
      <div className="price-values" aria-live="polite">
        <span>
          Brent <b>{current.brent === null ? 'Not recorded' : `$${current.brent.toFixed(2)}`}</b>
        </span>
        <span>
          Urals <b>{current.urals === null ? 'Not recorded' : `$${current.urals.toFixed(2)}`}</b>
        </span>
        <span>
          Difference{' '}
          <b>
            {current.urals === null || current.brent === null
              ? '—'
              : `$${(current.brent - current.urals).toFixed(2)}`}
          </b>
        </span>
      </div>
      <p className="chart-note">
        Dotted vertical line: US designations, 22 October 2025.
        <Citation id={8} /> Urals is a tax reference, not a contract price. Gaps are not
        interpolated.
      </p>
      <details>
        <summary>Read the data table</summary>
        <div className="price-table">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Brent</th>
                <th>Urals</th>
              </tr>
            </thead>
            <tbody>
              {priceData.map((r) => (
                <tr key={r.date}>
                  <th>{r.date}</th>
                  <td>{r.brent ?? '—'}</td>
                  <td>{r.urals ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

const portIds = ['N-P001', 'N-P002', 'N-P005', 'N-P007'];
const project = (point: readonly (number | null | undefined)[]) => {
  const lon = point[0],
    lat = point[1];
  if (lon === null || lon === undefined || lat === null || lat === undefined)
    throw new Error('Missing map position');
  return [((lon + 30) / 180) * 900, ((82 - lat) / 57) * 380];
};
const landPath = land.polygons
  .map((r) => r.map((p, i) => `${i ? 'L' : 'M'}${project(p).join(',')}`).join('') + 'Z')
  .join('');
const views: Record<string, string> = {
  all: '0 0 900 380',
  baltic: '86 59 410 173',
  black: '114 153 450 190',
  pacific: '590 167 450 190',
};
const steps = [
  { id: 'N-P001', area: 'baltic' },
  { id: 'N-P002', area: 'baltic' },
  { id: 'N-P005', area: 'black' },
  { id: 'N-P007', area: 'pacific' },
];
export function PortMap({ onOpen }: { onOpen: OpenReportNode }) {
  const [area, setArea] = useState('all');
  const [selected, setSelected] = useState('N-P001');
  const [tour, setTour] = useState(false);
  const openRecord: OpenReportNode = (element, id) => {
    setTour(false);
    onOpen(element, id);
  };
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!tour) return;
    const timer = setTimeout(() => {
      if (step === 3) setTour(false);
      else {
        const next = itemAt(steps, step + 1);
        setSelected(next.id);
        setArea(next.area);
        setStep(step + 1);
      }
    }, 1800);
    return () => clearTimeout(timer);
  }, [tour, step]);
  const reduce = useReducedMotion();
  return (
    <figure className="port-map" id="geography">
      <figcaption>
        <h3>Four gateways to the sea</h3>
        <p className="meta">
          Four documented locations <Citation id={10} />
          <Citation id={12} />
        </p>
      </figcaption>
      <div className="map-controls" role="group" aria-label="Map region">
        {(
          [
            ['all', 'All locations'],
            ['baltic', 'Baltic'],
            ['black', 'Black Sea'],
            ['pacific', 'Pacific'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={area === id}
            onClick={() => {
              setTour(false);
              setArea(id);
              const first = steps.find((s) => s.area === id);
              if (first) setSelected(first.id);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="map-tour-line">
        <button
          className="tour-button"
          onClick={() => {
            if (tour) setTour(false);
            else {
              setStep(0);
              setSelected(itemAt(steps, 0).id);
              setArea(itemAt(steps, 0).area);
              setTour(true);
            }
          }}
        >
          {tour ? 'Stop exploration' : 'Explore the ports →'}
        </button>
        <span aria-live="polite">
          <NodeLink id={selected} onOpen={openRecord} />
        </span>
      </div>
      <div className="map-window">
        <motion.svg
          initial={false}
          animate={{ viewBox: views[area] ?? '0 0 900 380' }}
          transition={{ duration: reduce ? 0 : 0.7, ease: [0.4, 0, 0.2, 1] }}
          role="group"
          aria-label="Map of four cited export locations"
        >
          <g>
            <path d={landPath} className="map-land" />
            {portIds.map((id) => {
              const n = nodeFor(id),
                [x, y] = project([n.lon, n.lat]);
              return (
                <g
                  key={id}
                  transform={`translate(${x},${y})`}
                  className="map-marker"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${n.name}`}
                  onClick={(e) => {
                    setSelected(id);
                    openRecord(e.currentTarget, id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelected(id);
                      openRecord(e.currentTarget, id);
                    }
                  }}
                >
                  {selected === id && (
                    <motion.circle
                      key={selected}
                      r="17"
                      fill="none"
                      stroke="var(--entity-port)"
                      vectorEffect="non-scaling-stroke"
                      initial={false}
                      animate={reduce ? { opacity: 0.5 } : { r: [12, 23], opacity: [0.8, 0] }}
                      transition={{ duration: 1.1, repeat: tour ? 1 : 0 }}
                    />
                  )}
                  <circle
                    r={selected === id ? 12 : 8}
                    fill="var(--background)"
                    stroke="var(--entity-port)"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path d="M-4-4H4V4H1V1H-1V4H-4Z" fill="var(--entity-port)" />
                </g>
              );
            })}
          </g>
        </motion.svg>
      </div>
      <div className="port-list">
        {portIds.map((id) => (
          <NodeLink key={id} id={id} onOpen={openRecord} />
        ))}
      </div>
      <p className="chart-note">
        Location points, not shipping routes. Ust-Luga, Novorossiysk and Kozmino use locality
        points; their position basis is available in each record. Basemap: Natural Earth.
      </p>
    </figure>
  );
}

const positions: Record<string, readonly [number, number]> = {
  'N-P034': [190, 170],
  'N-P020': [55, 65],
  'baltic-system': [190, 65],
  espo: [325, 65],
  ofac: [600, 170],
  'N-P026': [505, 65],
  'N-P030': [700, 65],
};
export function EvidenceGraph({ onOpen }: { onOpen: OpenReportNode }) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const query = matchMedia('(max-width: 800px)');
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const graphPositions = Object.fromEntries(
    Object.entries(positions).map(([id, point]) => [
      id,
      compact && ['ofac', 'N-P026', 'N-P030'].includes(id)
        ? [itemAt(point, 0) - 410, itemAt(point, 1) + 250]
        : point,
    ]),
  );

  const [selected, setSelected] = useState('N-P034');
  const reduce = useReducedMotion();
  const neighbours = new Set([
    selected,
    ...relations
      .filter((r) => r.from === selected || r.to === selected)
      .flatMap((r) => [r.from, r.to]),
  ]);
  return (
    <figure className="evidence-graph">
      <figcaption>
        <h3>Operations and designations</h3>
        <p className="meta">
          Selected relations · Two distinct structures <Citation id={11} />
          <Citation id={8} />
        </p>
      </figcaption>
      <div className="graph-window">
        <svg
          viewBox={compact ? '0 0 400 500' : '0 0 780 250'}
          role="group"
          aria-label="Transneft infrastructure relations and separate OFAC designations of Rosneft and Lukoil"
        >
          {relations.map((r, i) => {
            const start = graphPositions[r.from],
              end = graphPositions[r.to];
            if (start === undefined || end === undefined) throw new Error('Missing graph position');
            const x1 = itemAt(start, 0),
              y1 = itemAt(start, 1),
              x2 = itemAt(end, 0),
              y2 = itemAt(end, 1);
            return (
              <motion.g
                key={i}
                initial={false}
                animate={{ opacity: r.from === selected || r.to === selected ? 1 : 0.65 }}
                transition={{ duration: reduce ? 0 : 0.2 }}
              >
                <path
                  d={`M${x1} ${y1}L${x2} ${y2}`}
                  className={
                    'graph-edge ' +
                    (r.kind === 'owns'
                      ? 'ownership'
                      : r.kind === 'operates'
                        ? 'operation'
                        : 'designation')
                  }
                />
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 + (compact ? (i % 2 ? 0 : 24) : 12)}
                  textAnchor="middle"
                  className="edge-label"
                >
                  {r.kind}
                </text>
              </motion.g>
            );
          })}
          {Object.entries(graphPositions).map(([id, [x, y]]) => (
            <motion.g
              key={id}
              initial={false}
              animate={{ opacity: neighbours.has(id) ? 1 : 0.65 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
            >
              <g
                transform={`translate(${x},${y})`}
                role="button"
                tabIndex={0}
                aria-label={`Select ${nodeFor(id).name}`}
                className="graph-node"
                onClick={() => setSelected(id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(id);
                  }
                }}
              >
                <circle
                  r="23"
                  fill="var(--background)"
                  stroke={id === selected ? 'var(--ring)' : 'var(--border)'}
                />
                <svg x="-7" y="-7" width="14" height="14">
                  <Glyph type={nodeFor(id).type} />
                </svg>
                <text y={['N-P034', 'ofac'].includes(id) ? 48 : -35} textAnchor="middle">
                  {id === 'espo'
                    ? 'ESPO pipeline'
                    : id === 'baltic-system'
                      ? 'Baltic system'
                      : nodeFor(id).name}
                </text>
              </g>
            </motion.g>
          ))}
        </svg>
      </div>
      <div className="graph-selection">
        <span>Selected</span>
        <NodeLink id={selected} onOpen={onOpen} />
        <span className="meta">
          {relations.filter((r) => r.from === selected || r.to === selected).length} relations in
          this extract
        </span>
      </div>
      <p className="chart-note">
        Solid: ownership. Short dash: operation. Long dash: designation. Unrelated nodes stay
        visible. The two structures are not connected by an asserted relation.
      </p>
    </figure>
  );
}
