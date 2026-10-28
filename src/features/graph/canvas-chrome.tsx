import { cn } from '@/shared/lib/utils';

import { glyphSvg } from './glyph-svg';
import { legendOf } from './legend';
import { VARIANTS, type VariantId } from './variants';
import { lookOf } from './relation-families';
import type { ShownCounts, ShownOfTotal } from './shown-counts';

const CAPTION = 'text-caption tracking-caps text-label uppercase';

const of = (part: ShownOfTotal, noun: string): string =>
  part.shown === part.total
    ? `${String(part.total)} ${noun}`
    : `${String(part.shown)} of ${String(part.total)} ${noun}`;

/** The status bar at the top left of the canvas. */
export function StatusBar({ counts }: { readonly counts: ShownCounts }) {
  return (
    <p role="status" className={cn('absolute top-2 left-2 z-10 px-1 font-mono', CAPTION)}>
      {of(counts.entities, 'entities')} · {of(counts.relations, 'relations')}
    </p>
  );
}

function Glyph({ type, colour }: { readonly type: string; readonly colour: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-3.5 shrink-0"
      ref={(element) => {
        element?.replaceChildren(glyphSvg(type, colour));
      }}
    />
  );
}

interface LegendProps {
  readonly counts: ShownCounts;
  readonly hueOfType: ReadonlyMap<string, string>;
  readonly labelOfType: (type: string) => string;
}

/** The dash of a family as an SVG `stroke-dasharray`: none for a solid line. */
const dashArray = (dash: readonly [number, number, number, number]): string | undefined =>
  dash[1] === 0 ? undefined : (dash[2] === 0 ? dash.slice(0, 2) : dash).join(' ');

/** The legend at the bottom left: only the types and the families in view. */
export function Legend({ counts, hueOfType, labelOfType }: LegendProps) {
  const { types, families } = legendOf(counts);
  if (types.length === 0 && families.length === 0) return null;
  return (
    <div
      className={cn(
        'absolute bottom-2 left-2 z-10 hidden w-52 flex-col gap-2 rounded-sm border border-border',
        'bg-surface p-2 text-data md:flex',
      )}
    >
      <ul aria-label="Entity types" className="flex flex-col gap-1">
        {types.map(({ key, count }) => (
          <li key={key} className="flex items-center gap-2">
            <Glyph type={key} colour={hueOfType.get(key) ?? 'currentColor'} />
            <span className="min-w-0 flex-1 truncate">{labelOfType(key)}</span>
            <span className="font-mono tabular-nums">{count}</span>
          </li>
        ))}
      </ul>
      <ul
        aria-label="Relation families"
        className="flex flex-col gap-1 border-t border-border pt-2"
      >
        {families.map(({ key, count }) => {
          const { label, dash } = lookOf(key);
          return (
            <li key={key} className="flex items-center gap-2">
              <svg aria-hidden="true" width="14" height="2" className="shrink-0">
                <line
                  x1="0"
                  y1="1"
                  x2="14"
                  y2="1"
                  stroke={`var(--relation-${key})`}
                  strokeWidth="1.5"
                  strokeDasharray={dashArray(dash)}
                />
              </svg>
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <span className="font-mono tabular-nums">{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const ZOOM_BUTTON = cn(
  'flex size-8 items-center justify-center rounded-sm border border-border bg-surface',
  'text-body-sm text-foreground transition-colors duration-100 hover:bg-surface-secondary',
  'outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

/** The zoom buttons at the bottom right. */
export function ZoomButtons({ onZoom }: { readonly onZoom: (direction: 'in' | 'out') => void }) {
  return (
    <div className="absolute right-2 bottom-2 z-10 flex flex-col gap-1">
      <button
        type="button"
        aria-label="Zoom in"
        className={ZOOM_BUTTON}
        onClick={() => {
          onZoom('in');
        }}
      >
        +
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        className={ZOOM_BUTTON}
        onClick={() => {
          onZoom('out');
        }}
      >
        −
      </button>
    </div>
  );
}

/** The row of prototypes at the top of the canvas, one square button for each. */
export function VariantSwitch({
  current,
  onPick,
}: {
  readonly current: VariantId;
  readonly onPick: (id: VariantId) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Layout"
      className="absolute top-2 right-2 z-10 flex border border-border bg-surface"
    >
      {VARIANTS.map(({ id, label, reading }) => (
        <button
          key={id}
          type="button"
          title={reading}
          aria-label={`${label}: ${reading}`}
          aria-pressed={id === current}
          onClick={() => {
            onPick(id);
          }}
          className={cn(
            'px-3 py-1.5 text-data focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1',
            id === current ? 'bg-muted text-foreground underline underline-offset-4' : 'text-label',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
