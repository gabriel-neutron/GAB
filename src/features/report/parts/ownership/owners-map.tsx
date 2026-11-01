import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import land from '../../basemap-data';
import { accent } from '../../primitives/accent';
import { useContent } from '../../use-content';
import { useReport } from '../../use-report';
import { nodeSites, owners } from './owners-join';

const FOCUS =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring';
// The box of the sites: equirectangular, with the longitude scaled by cos(57 N) for a true shape near the middle.
const BOX = { west: 24, east: 80, south: 40, north: 74 };
const K = Math.cos((57 * Math.PI) / 180);
const W = (BOX.east - BOX.west) * K * 10;
const H = (BOX.north - BOX.south) * 10;
const px = (lon: number, lat: number) =>
  [(lon - BOX.west) * K * 10, (BOX.north - lat) * 10] as const;
const LAND = land.polygons
  .map(
    (ring) =>
      ring
        .map(([lon = 0, lat = 0], i) => {
          const [x, y] = px(lon, lat);
          return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join('') + 'Z',
  )
  .join('');
// One accent per chart: the private controllers take it, the federal state stays in the text colour.
const STATE = 'Russian federal state';

// The smallest gap between two points, in map units: a 24px target on a phone-wide map.
const GAP = 22;
const placed: (readonly [number, number])[] = [];
const rows = owners.flatMap((owner, index) => {
  const site = nodeSites.get(owner.nodeId);
  const holder = nodeSites.get(owner.holderId);
  if (site === undefined || holder === undefined) return [];
  let [x, y] = px(Number(site.lon), Number(site.lat));
  // A point too near an earlier one moves away from it (Novorossiysk and Tuapse): the table keeps the place.
  // shortcut: one push for each earlier point, enough for a few far sites; use a force layout when the sites crowd.
  for (const [ox, oy] of placed) {
    const d = Math.hypot(x - ox, y - oy);
    if (d < GAP) {
      const [ux, uy] = d === 0 ? [0, 1] : [(x - ox) / d, (y - oy) / d];
      [x, y] = [ox + ux * GAP, oy + uy * GAP];
    }
  }
  placed.push([x, y]);
  return [{ ...owner, number: index + 1, site, holder, x, y }];
});
const controllers = [...new Set(rows.map((row) => row.controller))];
// The oldest check of the rows: the caption claims no later date for any row.
const CHECKED = rows.map((row) => row.checked).sort()[0] ?? '';
const COLUMNS = ['site', 'holder', 'relation', 'controller', 'documents'] as const;

/** The owners map: each site of the join at its position, numbered, in the colour of the
 * controller class of its holder. A point or a name opens the panel of its node. */
export function OwnersMap() {
  const { openNode } = useReport();
  const { ownershipUi } = useContent();
  const copy = ownershipUi.owners;
  // The join test makes sure that the copy has each word; a missing one shows its key.
  const words = (map: Readonly<Record<string, string>>) => (key: string) => map[key] ?? key;
  const label = words(copy.labels);
  const relation = words(copy.relations);
  const nodeButton = (id: string, name: string) => (
    <button
      type="button"
      onClick={(event) => {
        openNode(id, event.currentTarget);
      }}
      className={cn(
        'min-h-6 text-left underline decoration-muted-foreground/60 decoration-dotted underline-offset-4 hover:decoration-foreground',
        FOCUS,
      )}
    >
      {name}
    </button>
  );
  return (
    <div>
      <ul className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
        {controllers.map((controller) => (
          <li
            key={controller}
            className="flex items-center gap-2 text-report-small text-muted-foreground"
          >
            <span
              aria-hidden="true"
              className={cn(
                'size-2.5 shrink-0 rounded-full',
                controller === STATE ? 'bg-foreground' : accent.bg,
              )}
            />
            {label(controller)}
          </li>
        ))}
      </ul>
      <div className="relative mx-auto max-w-[36rem]" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 size-full border border-border bg-map-water"
        >
          <path d={LAND} fill="var(--map-land)" stroke="var(--map-boundary)" strokeWidth={0.6} />
        </svg>
        {/* The points are buttons over the map, so a keyboard reaches each site; the table gives the same rows. */}
        <ol aria-label={copy.mapLabel}>
          {rows.map((row) => (
            <li
              key={row.nodeId}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${(row.x / W) * 100}%`, top: `${(row.y / H) * 100}%` }}
            >
              <button
                type="button"
                aria-label={`${String(row.number)}. ${row.holder.name} ${relation(row.relation)} ${row.site.name}`}
                onClick={(event) => {
                  openNode(row.nodeId, event.currentTarget);
                }}
                className={cn('group grid size-6 place-items-center', FOCUS)}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-5 place-items-center rounded-full font-mono text-report-label leading-none tabular-nums text-background transition-transform duration-150 group-hover:scale-125 motion-reduce:transition-none',
                    row.controller === STATE ? 'bg-foreground' : accent.bg,
                  )}
                >
                  {row.number}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-2 font-mono text-report-label text-label">
        {land.source} · {copy.checked.replace('{date}', CHECKED)}
      </p>
      <details className="group mt-6 border-y border-foreground" open>
        <summary
          className={cn(
            'flex min-h-12 cursor-pointer list-none items-center gap-3 py-2 text-report-small [&::-webkit-details-marker]:hidden',
            FOCUS,
          )}
        >
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform group-open:rotate-180"
          />
          <span className="min-w-0 flex-1">{copy.table}</span>
          <span className="font-mono text-report-label text-label tabular-nums uppercase">
            {copy.rows.replace('{n}', String(rows.length))}
          </span>
        </summary>
        <div className="mb-4 overflow-x-auto" tabIndex={0} role="region" aria-label={copy.table}>
          <table className="w-full min-w-[40rem] border-collapse text-left text-report-small">
            <thead>
              <tr className="border-b border-border font-mono text-report-label uppercase text-label">
                <th scope="col" className="py-2 pr-4 font-normal">
                  #
                </th>
                {COLUMNS.map((column) => (
                  <th key={column} scope="col" className="py-2 pr-4 font-normal">
                    {copy.columns[column]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.nodeId} className="border-b border-divider align-top">
                  <td className="py-2 pr-4 font-mono text-report-label tabular-nums">
                    {row.number}
                  </td>
                  <td className="py-2 pr-4">{nodeButton(row.nodeId, row.site.name)}</td>
                  <td className="py-2 pr-4">{nodeButton(row.holderId, row.holder.name)}</td>
                  <td className="py-2 pr-4 font-mono text-report-label">
                    {relation(row.relation)}
                    {row.sharePct === '' ? '' : ` ${row.sharePct}%`}
                    {row.shareAsOf === '' ? '' : ` ${copy.asOf.replace('{date}', row.shareAsOf)}`}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={row.controller === STATE ? '' : accent.text}>
                      {label(row.controller)}
                    </span>
                    <span className="block font-mono text-report-label text-label">
                      {label(row.holding)}
                    </span>
                    {row.outsideFigure ? (
                      <span className="mt-1 block text-report-label text-muted-foreground">
                        {copy.outsideFigure}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 font-mono text-report-label break-all text-label">
                    {row.documents.join(' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
