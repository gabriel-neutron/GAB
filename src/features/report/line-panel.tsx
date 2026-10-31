// One panel of a yearly line chart, shared by the report figures. A missing value breaks the line and
// is not drawn as zero. Colour: `old` in foreground, `new` in signal (the one highlight), `other` in grey.

/** Rows of a report data file (research CSV copied to ./data): quoted fields may hold commas. */
export function readCsv(raw: string): Record<string, string>[] {
  const [head = [], ...body] = raw
    .trim()
    .split(/\r?\n/)
    .map((line) =>
      [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)].map((m) =>
        (m[1] ?? '').replace(/^"|"$/g, '').replaceAll('""', '"'),
      ),
    );
  return body.map((cells) => Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ''])));
}

export interface Series {
  label: string;
  tone: 'old' | 'new' | 'other';
  points: (number | undefined)[];
  /** A hollow mark: an estimate or a plan, not an executed or reported value. */
  hollow?: boolean[];
  dashed?: boolean;
  /** The end label; defaults to the label and the last value. */
  end?: string;
}

const PH = 250,
  TOP = 46,
  LEFT = 34,
  RIGHT = 84;
export const PANEL_HEIGHT = TOP + PH + 32;

export function LinePanel({
  x0,
  width,
  title,
  unit,
  years,
  max,
  ticks,
  series,
  event,
  events = event ? [event] : [],
  min = 0,
  right = RIGHT,
  tickEvery = 1,
  digits = 0,
}: {
  x0: number;
  width: number;
  title: string;
  unit: string;
  years: number[];
  max: number;
  ticks: number[];
  series: Series[];
  /** A dated marker: its position on the yearly axis and its label. */
  event?: { at: number; label: string };
  events?: { at: number; label: string }[];
  /** The bottom of the value axis; an index chart starts above zero. */
  min?: number;
  /** Room for the end labels, in pixels. */
  right?: number;
  tickEvery?: number;
  digits?: number;
}) {
  const first = years[0] ?? 0;
  const x = (i: number) => x0 + LEFT + (i / (years.length - 1)) * (width - LEFT - right);
  const y = (v: number) => TOP + PH - ((v - min) / (max - min)) * PH;
  // End labels in value order, pushed apart so that two labels never touch.
  const ends = series
    .map((s) => {
      const i = s.points.findLastIndex((v) => v !== undefined);
      return { s, i, v: s.points[i] };
    })
    .filter((e): e is { s: Series; i: number; v: number } => e.v !== undefined)
    .sort((a, b) => y(a.v) - y(b.v));
  // Each label sits at its line end, and at least 14 units below the label above it.
  const placed: { label: string; y: number; x: number; v: number }[] = [];
  for (const e of ends)
    placed.push({
      label: e.s.label,
      y: Math.max(y(e.v) + 4, (placed.at(-1)?.y ?? -Infinity) + 14),
      x: x(e.i) + 8,
      v: e.v,
    });
  const labelY = new Map(placed.map(({ label, ...at }) => [label, at] as const));
  return (
    <g>
      <text x={x0} y="12" className="lp-title">
        {title}
      </text>
      <text x={x0} y={TOP - 12} className="lp-axis">
        {unit}
      </text>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x0 + LEFT} x2={x0 + width - right} y1={y(t)} y2={y(t)} className="plot-grid" />
          <text x={x0 + LEFT - 6} y={y(t) + 4} textAnchor="end" className="lp-axis">
            {t}
          </text>
        </g>
      ))}
      {years.map((yr, i) =>
        (yr - first) % tickEvery === 0 ? (
          <text key={yr} x={x(i)} y={TOP + PH + 20} textAnchor="middle" className="lp-axis">
            {yr}
          </text>
        ) : null,
      )}
      {events.map((e, i) => (
        <g key={e.label}>
          <line
            x1={x(e.at - first)}
            x2={x(e.at - first)}
            y1={TOP}
            y2={TOP + PH}
            className="event-rule"
          />
          <text x={x(e.at - first) + 4} y={TOP + 10 + i * 14} className="lp-axis">
            {e.label}
          </text>
        </g>
      ))}
      {series.map((s) => {
        let d = '';
        s.points.forEach((v, i) => {
          if (v === undefined) return;
          d += `${d && s.points[i - 1] !== undefined ? 'L' : 'M'}${x(i)},${y(v)}`;
        });
        const end = labelY.get(s.label);
        return (
          <g key={s.label} className={`lp-series ${s.tone}`}>
            <path d={d} className={s.dashed ? 'lp-line dashed' : 'lp-line'} />
            {s.points.map((v, i) =>
              v === undefined ? null : (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(v)}
                  r="3"
                  className={s.hollow?.[i] ? 'lp-dot hollow' : 'lp-dot'}
                />
              ),
            )}
            {end && (
              <text x={end.x} y={end.y} className="lp-label">
                {s.end ?? `${s.label} ${end.v.toFixed(digits)}`}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
