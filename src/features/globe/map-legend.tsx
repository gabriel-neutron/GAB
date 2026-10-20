import { lineRows, pointRows, type LineRow } from './legend-rows';

const WIDTH = 3;
const LENGTH = 32;

// The canvas gives a dash in units of the width of the line, so the drawing here does the same.
const dashArray = (dash: LineRow['dash']): string | undefined =>
  dash === null ? undefined : dash.map((one) => String(one * WIDTH)).join(' ');

function Line({ row }: { readonly row: LineRow }) {
  const stroke = row.review ? 'var(--color-muted-foreground)' : 'var(--color-foreground)';
  return (
    <svg width={LENGTH} height="8" aria-hidden="true" className="shrink-0">
      <line
        x1="0"
        y1="4"
        x2={LENGTH}
        y2="4"
        stroke={stroke}
        strokeWidth={WIDTH}
        strokeDasharray={dashArray(row.dash)}
      />
      {row.hollow ? (
        <line x1="0" y1="4" x2={LENGTH} y2="4" stroke="var(--color-background)" strokeWidth="1.5" />
      ) : null}
    </svg>
  );
}

/** What the map draws, in words: the colour of a point, the look of a line and the ring of an exit
 * point. It reads the same layers as the canvas. */
export function MapLegend() {
  return (
    <section aria-label="Legend" className="flex flex-col gap-1 border-t border-border px-2 py-1">
      <ul aria-label="Points" className="flex flex-wrap gap-x-4 gap-y-1">
        {pointRows().map((one) => (
          <li key={one.key} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block size-2 shrink-0 rounded-full"
              // External constraint: the hue of a stage is a hex that the canvas shares.
              style={{ backgroundColor: one.colour }}
            />
            {one.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block size-2.5 shrink-0 rounded-full border-2 border-muted-foreground"
          />
          Exit point, computed from the relations
        </li>
      </ul>
      <ul aria-label="Lines" className="flex flex-wrap gap-x-4 gap-y-1">
        {lineRows().map((one) => (
          <li key={one.style} className="flex items-center gap-1.5">
            <Line row={one} />
            {one.label}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">
        The map draws the own position of an entity only. It draws no borrowed position.
      </p>
    </section>
  );
}
