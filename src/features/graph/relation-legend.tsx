import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

import type { DashPattern } from './relation-families';
import type { LegendFamily } from './relation-legend-rows';

interface RelationLegendProps {
  readonly legend: readonly LegendFamily[];
  /** A relation type was switched on or off. */
  readonly onSwitch: (type: string, on: boolean) => void;
}

const CONTROL = cn(
  'flex min-h-6 w-full items-center gap-1.5 border border-transparent px-1 text-left',
  'transition-colors duration-100 hover:bg-muted',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

const dashArray = (pattern: DashPattern): string | undefined =>
  pattern[1] === 0 ? undefined : pattern.join(' ');

function Line({ pattern, colour }: { readonly pattern: DashPattern; readonly colour: string }) {
  return (
    <svg width="32" height="6" aria-hidden="true" className="shrink-0">
      <line
        x1="0"
        y1="3"
        x2="32"
        y2="3"
        stroke={colour}
        strokeWidth="2"
        strokeDasharray={dashArray(pattern)}
      />
    </svg>
  );
}

const figure = (shown: number, total: number): string => `${String(shown)} of ${String(total)}`;

// The legend states what the drawing paints: the same hex and the same dash pattern, read from
// the same constant as the canvas. The count of each row is the count of the line above the
// island, so a switch changes both.
export function RelationLegend({ legend, onSwitch }: RelationLegendProps) {
  if (legend.length === 0) return null;

  return (
    <section
      aria-label="Relation families"
      className={cn('grid gap-x-4 gap-y-2 px-2 py-2 sm:grid-cols-2 lg:grid-cols-5')}
    >
      {legend.map((family) => (
        <div key={family.key} data-family={family.key} className={cn('min-w-0')}>
          <div className={cn('flex min-h-6 items-center gap-1.5 px-1')}>
            <span className="dark:hidden">
              <Line pattern={family.look.dash} colour={family.look.hue.light} />
            </span>
            <span className="hidden dark:inline">
              <Line pattern={family.look.dash} colour={family.look.hue.dark} />
            </span>
            <span className={cn('min-w-0 flex-1 break-words text-foreground')}>
              {family.look.label}
            </span>
            <span className={cn('shrink-0 font-mono text-muted-foreground tabular-nums')}>
              {figure(family.shown, family.total)}
            </span>
          </div>
          <ul>
            {family.types.map((row) => (
              <li key={row.type}>
                <button
                  type="button"
                  aria-pressed={row.on}
                  onClick={() => {
                    onSwitch(row.type, !row.on);
                  }}
                  className={CONTROL}
                >
                  <span className={cn('min-w-0 flex-1 py-0.5 break-words')}>{row.label}</span>
                  <span className={cn('shrink-0 font-mono text-muted-foreground tabular-nums')}>
                    {figure(row.shown, row.total)}
                  </span>
                  <span className="sr-only">{row.on ? 'shown' : 'hidden'}</span>
                  {row.on ? (
                    <Eye size={14} aria-hidden="true" className="shrink-0 text-label" />
                  ) : (
                    <EyeOff size={14} aria-hidden="true" className="shrink-0 text-label" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
