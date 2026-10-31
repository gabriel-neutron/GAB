import { cn } from '@/shared/lib/utils';
import { fightUi } from '../../content';
import { chainCount, stages, type Share, type Total } from './chain-data';

const CELL: Record<Share['tone'], string> = {
  accent: 'bg-signal',
  ink: 'bg-foreground',
  dim: 'bg-label/60',
};

// A group the source could not place is drawn hollow.
const cellClass = (share: Share) =>
  share.group === 'Not identified' ? 'border border-label' : CELL[share.tone];

/** The three stages of the chain as strips of 100 cells, one cell for each percent: the cells of
 * the coalition narrow from the brand to the final seller. The share of China and Hong Kong stands
 * at the left of each strip, in the accent for the stage in view, with the number of its step.
 * After the three stages the strips go away, so the panel never names a stage that is not in view.
 * On a phone only the stage in view shows. */
export function ChainStrips({ active }: { readonly active: number | 'all' }) {
  const past = active !== 'all' && active >= stages.length;
  const shown = active === 'all' ? 'all' : Math.min(active, stages.length - 1);
  return (
    <div className={cn('grid gap-2 lg:gap-3', past && 'hidden')}>
      <p className="flex items-center gap-1.5 font-mono text-report-label uppercase text-label">
        <span aria-hidden="true" className="size-2.5 shrink-0 bg-signal" />
        {fightUi.chain.chinaShare}
      </p>
      {stages.map((stage, index) => {
        const on = shown === 'all' || shown === index;
        const lit = on && !past;
        const china = stage.shares.find((share) => share.tone === 'accent');
        return (
          <div
            key={stage.name}
            className={cn(
              'grid-cols-[4.75rem_minmax(0,1fr)] items-end gap-x-3 lg:grid lg:grid-cols-[6.5rem_minmax(0,1fr)]',
              on ? 'grid' : 'hidden',
            )}
          >
            <span
              className={cn(
                'text-right font-mono text-report-lead  tracking-[-0.04em] tabular-nums',
                lit && active !== 'all' ? 'text-signal' : 'text-muted-foreground',
              )}
            >
              {china?.text}%
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  'truncate font-mono text-report-label uppercase',
                  lit ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                <span className={cn('mr-2', lit && active !== 'all' && 'text-signal')}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                {stage.name}
              </p>
              <div
                aria-hidden="true"
                className={cn(
                  'mt-1 grid grid-cols-25 gap-px transition-opacity duration-200 sm:grid-cols-50',
                  lit ? 'opacity-100' : 'opacity-40',
                )}
              >
                {stage.shares.flatMap((share) =>
                  Array.from({ length: share.cells }, (_unused, cell) => (
                    <span
                      key={`${share.group}-${String(cell)}`}
                      className={cn('aspect-square', cellClass(share))}
                    />
                  )),
                )}
              </div>
            </div>
          </div>
        );
      })}
      <ul className="ml-[5.5rem] lg:ml-[7.25rem] flex flex-wrap gap-x-4 gap-y-1 font-mono text-report-label text-muted-foreground">
        {(stages[0]?.shares ?? []).map((share) => (
          <li key={share.group} className="flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden="true" className={cn('size-2.5 shrink-0', cellClass(share))} />
            {share.group}
          </li>
        ))}
        <li className="whitespace-nowrap">One cell = 1 point, rounded</li>
      </ul>
    </div>
  );
}

const ACCENT = new Set(['China', 'Hong Kong']);

/** One list of figure 11 chains, as bars, largest first. China and Hong Kong carry
 * the accent. */
export function ChainTotals({
  title,
  totals,
  max = Math.max(...totals.map((total) => total.chains)),
}: {
  readonly title: string;
  readonly totals: readonly Total[];
  /** The value at the full width; one max for several lists puts them on one scale. */
  readonly max?: number;
}) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-report-label uppercase text-label">
        {title}
        <span className="block normal-case">{fightUi.chain.chainUnit}</span>
      </p>
      <ul className="mt-2 grid border-t border-divider">
        {totals.map((total) => (
          <li
            key={total.name}
            className="grid grid-cols-[minmax(0,8.5rem)_1fr_3rem] sm:grid-cols-[minmax(0,12rem)_1fr_3rem] items-center gap-2 border-b border-divider py-1 text-report-small"
          >
            <span className="break-words">{total.name}</span>
            <span className="h-1.5 bg-chart-grid">
              <span
                className={cn(
                  'block h-full origin-left',
                  ACCENT.has(total.name) ? 'bg-signal' : 'bg-foreground/70',
                )}
                style={{ transform: `scaleX(${String(total.chains / max)})` }}
              />
            </span>
            <span className="text-right font-mono text-report-label tabular-nums">
              {chainCount(total.chains)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
