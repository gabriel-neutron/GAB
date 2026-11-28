import { useRef } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/shared/lib/utils';
import { accent } from '../../primitives/accent';
import { useContent } from '../../use-content';
import { chartLayout } from './chart-layout';
import { figureData } from './figure-data';
import { useSize } from './use-size';

const SHADOW = 'Shadow fleet';

const COLUMNS = [
  ['Baltic', 'Black Sea', 'Pacific', 'Arctic']
    .map((basin) => `Crude · ${basin}`)
    .concat(['Baltic', 'Black Sea', 'Pacific', 'Arctic'].map((basin) => `Products · ${basin}`)),
  [SHADOW, 'IG-insured', 'Coalition, no IG cover'],
  ['Seaborne crude', 'Seaborne products'],
  ['China', 'India', 'Turkey', 'Singapore', 'Brazil', 'Other countries', 'Unknown destination'],
];
const HEADS = ['BASSIN DE CHARGEMENT', 'FLOTTE (CATÉGORIE KSE)', 'PRODUIT', 'ACHETEUR'];
const inChart = new Set(COLUMNS.flat());
const seaRows = figureData.flows.filter((row) => row.panel === 'a');
const LINKS = seaRows.flatMap((row) =>
  inChart.has(row.from) && inChart.has(row.to) && row.value !== null
    ? [{ from: row.from, to: row.to, value: row.value }]
    : [],
);
const designated = new Map(
  seaRows
    .filter((row) => row.to === 'share on designated tankers')
    .map((row) => [row.from, row.value]),
);

const HEIGHT = 440;
const TOP = 32;
const NODE = 10;
const RIGHT = 230;
// The width of the box from which the bands replace the list.
const WIDE = 900;
/** The words of figure 7 in the page locale: its texts, its labels (a French label of the
 * publication, or a name of the data), the words of the table and the number format. */
function useFigure() {
  const { figureTexts, portsFleetUi, ui } = useContent();
  const texts = figureTexts.figures['7'];
  const labels: Readonly<Partial<Record<string, string>>> = texts.labels;
  const nameOf = (name: string) => labels[name] ?? name;
  const shareOf = (name: string) => {
    const share = designated.get(name);
    return share === undefined || share === null
      ? ''
      : (labels['{v} % désignés (CREA)'] ?? '').replace('{v}', String(share));
  };
  const number = new Intl.NumberFormat(ui.numberLocale);
  return { texts, labels, copy: portsFleetUi.flows, number, nameOf, shareOf };
}

/** Figure 7: seaborne oil in January 2026 as bands between neighbouring columns (loading basin,
 * fleet category, product, buyer). No band joins a fleet
 * category to a buyer: no source links them. On a phone each stage is a row of bars. */
export function FleetFlows() {
  const box = useRef<HTMLDivElement>(null);
  const { width } = useSize(box);
  const { texts, labels, copy, number } = useFigure();
  const panelA = texts.panels.find((panel) => panel.id === 'a');
  return (
    <div className="grid gap-12">
      <div className="min-w-0">
        <p className="font-mono text-report-label uppercase text-foreground">{panelA?.title}</p>
        <p className="font-mono text-report-label uppercase text-label">{panelA?.unit}</p>
        <p className="mt-1 mb-4 max-w-[64ch] text-report-small text-muted-foreground">
          {
            labels[
              'Chaque bande relie deux colonnes voisines : aucune source ne relie une catégorie de flotte à un acheteur.'
            ]
          }
        </p>
        {/* The bands are one image; the list is real text, so it keeps its own roles. Under 900px
            a column has no room for its 13px labels, so the list replaces the bands. */}
        <div
          ref={box}
          role={width >= WIDE ? 'img' : undefined}
          aria-label={width >= WIDE ? panelA?.title : undefined}
        >
          {width === 0 ? (
            <div style={{ height: HEIGHT + TOP }} />
          ) : width < WIDE ? (
            <StageList />
          ) : (
            <HorizontalFlow width={width} />
          )}
        </div>
      </div>
      <details className="border-t border-border pt-3">
        <summary className="flex min-h-11 cursor-pointer items-center font-mono text-report-label text-label">
          {copy.table}
        </summary>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-left font-mono text-report-label">
            <thead className="text-label uppercase">
              <tr>
                <th className="py-1 pr-4 font-normal">{copy.from}</th>
                <th className="py-1 pr-4 font-normal">{copy.to}</th>
                <th className="py-1 pr-4 text-right font-normal">{copy.value}</th>
                <th className="py-1 font-normal">{copy.state}</th>
              </tr>
            </thead>
            <tbody>
              {figureData.flows.map((row) => (
                <tr key={`${row.panel}-${row.from}-${row.to}`} className="border-t border-divider">
                  <td className="py-1 pr-4">{labels[row.from] ?? row.from}</td>
                  <td className="py-1 pr-4">{labels[row.to] ?? row.to}</td>
                  <td className="py-1 pr-4 text-right tabular-nums">
                    {row.value === null ? '' : `${number.format(row.value)} ${row.unit}`}
                  </td>
                  <td className="py-1 text-label">{row.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

interface BandProps {
  readonly d: string;
  readonly shadow: boolean;
  readonly column: number;
}

function Band({ d, shadow, column }: BandProps) {
  return (
    <motion.path
      d={d}
      className={cn('stroke-background', shadow ? accent.fill : 'fill-chart-neutral')}
      strokeWidth={1}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: shadow ? 0.6 : 0.4 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay: 0.15 * column }}
    />
  );
}

/** The flow from left to right: every label stands right of its node, on a chip of the ground. */
function HorizontalFlow({ width }: { readonly width: number }) {
  const { labels, number, nameOf, shareOf } = useFigure();
  const { nodes, bands } = chartLayout.sankey(COLUMNS, LINKS, HEIGHT, 8);
  const span = (width - RIGHT - NODE) / (COLUMNS.length - 1);
  const x = (column: number) => column * span;
  const spots = COLUMNS.map((_, column) => {
    const inColumn = nodes.filter((node) => node.column === column);
    const at = chartLayout.spread(
      inColumn.map((node) => node.y + node.height / 2),
      inColumn.some((node) => designated.has(node.name)) ? 34 : 20,
      8,
      HEIGHT - 8,
    );
    return new Map(inColumn.map((node, index) => [node.name, at[index] ?? 0]));
  });
  return (
    <div className="relative" style={{ height: HEIGHT + TOP }}>
      <svg width={width} height={HEIGHT + TOP} aria-hidden="true" className="block">
        {HEADS.map((head, column) => (
          <text
            key={head}
            x={x(column)}
            y={12}
            className="fill-label font-mono text-report-label uppercase"
          >
            {labels[head]}
          </text>
        ))}
        <g transform={`translate(0,${String(TOP)})`}>
          {bands.map((band) => {
            const x0 = x(band.column) + NODE;
            const x1 = x(band.column + 1);
            const mid = (x0 + x1) / 2;
            return (
              <Band
                key={`${band.from}-${band.to}`}
                column={band.column}
                shadow={band.from === SHADOW || band.to === SHADOW}
                d={`M${x0},${band.y0}C${mid},${band.y0} ${mid},${band.y1} ${x1},${band.y1}L${x1},${band.y1 + band.thick}C${mid},${band.y1 + band.thick} ${mid},${band.y0 + band.thick} ${x0},${band.y0 + band.thick}Z`}
              />
            );
          })}
          {nodes.map((node) => (
            <rect
              key={node.name}
              x={x(node.column)}
              y={node.y}
              width={NODE}
              height={Math.max(1, node.height)}
              className={node.name === SHADOW ? accent.fill : 'fill-foreground'}
            />
          ))}
        </g>
      </svg>
      {nodes.map((node) => {
        const share = shareOf(node.name);
        return (
          <p
            key={node.name}
            aria-hidden="true"
            className="absolute -translate-y-1/2 bg-background px-1.5 py-0.5 font-mono text-report-label/4 whitespace-nowrap"
            style={{
              left: x(node.column) + NODE + 4,
              top: TOP + (spots[node.column]?.get(node.name) ?? 0),
            }}
          >
            <span className={node.name === SHADOW ? accent.text : 'text-foreground'}>
              {nameOf(node.name)}
            </span>{' '}
            <span className="text-label tabular-nums">{number.format(node.value)}</span>
            {share === '' ? null : <span className="block text-label">{share}</span>}
          </p>
        );
      })}
    </div>
  );
}

/** The flow of a phone: one row for each stage, with one bar for each node of the stage, at one
 * scale for all stages. */
function StageList() {
  const { labels, number, nameOf, shareOf } = useFigure();
  const { nodes } = chartLayout.sankey(COLUMNS, LINKS, 100, 0);
  const max = Math.max(...nodes.map((node) => node.value));
  return (
    <ol className="grid gap-8">
      {HEADS.map((head, column) => (
        <li key={head} className="border-t border-border pt-3">
          <p className="mb-3 font-mono text-report-label uppercase text-label">
            {String(column + 1).padStart(2, '0')} · {labels[head]}
          </p>
          <ul className="grid gap-2.5">
            {nodes
              .filter((node) => node.column === column)
              .map((node) => {
                const shadow = node.name === SHADOW;
                const share = shareOf(node.name);
                return (
                  <li key={node.name} className="font-mono text-report-label">
                    <p className="flex justify-between gap-3">
                      <span className={shadow ? accent.text : 'text-foreground'}>
                        {nameOf(node.name)}
                      </span>
                      <span className="text-foreground tabular-nums">
                        {number.format(node.value)}
                      </span>
                    </p>
                    <span
                      aria-hidden="true"
                      className={cn('mt-1 block h-1.5', shadow ? accent.bg : 'bg-chart-neutral')}
                      style={{ width: `${String(Math.max(0.5, (node.value / max) * 100))}%` }}
                    />
                    {share === '' ? null : <span className="mt-1 block text-label">{share}</span>}
                  </li>
                );
              })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
