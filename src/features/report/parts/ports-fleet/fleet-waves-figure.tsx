import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { accent } from '../../primitives/accent';
import { useContent } from '../../use-content';
import { REGIMES, selectWaves, type Regime } from './fleet-waves';
import { ValuesTable } from './values-table';

// One regime takes the accent of the report: OFAC.
const TONE: Readonly<Record<Regime, string>> = {
  EU: 'bg-foreground',
  UK: 'bg-chart-neutral',
  OFAC: accent.bg,
};
// The scales stay those of all regimes, so a filter never stretches the bars.
const all = selectWaves(new Set(REGIMES));
const PEAK = Math.max(
  ...all.quarters.map((one) => REGIMES.reduce((total, regime) => total + one.values[regime], 0)),
);
const TOP = Math.ceil(PEAK / 100) * 100;
const TICKS = Array.from({ length: TOP / 100 }, (_, index) => (index + 1) * 100);
const number = new Intl.NumberFormat('en-US');

/** The tankers that the EU, the UK and OFAC designate, by quarter and by the regimes that
 * designate each tanker. A filter shows or hides a regime; each tanker stays in one group. */
export function FleetWavesFigure() {
  const { portsFleetUi } = useContent();
  const copy = portsFleetUi.waves;
  const [shown, setShown] = useState<ReadonlySet<Regime>>(() => new Set(REGIMES));
  const data = selectWaves(shown);
  const visible = REGIMES.filter((regime) => shown.has(regime));
  const partial = data.quarters.find((one) => one.partial);
  const toggle = (regime: Regime) => {
    setShown((before) => {
      const next = new Set(before);
      if (next.has(regime)) next.delete(regime);
      else next.add(regime);
      return next;
    });
  };
  const names = (regimes: readonly Regime[]) =>
    regimes.map((regime) => copy.regimes[regime]).join(' + ');
  return (
    <div className="grid gap-y-12">
      <div role="group" aria-label={copy.filters} className="flex flex-wrap gap-x-6">
        {REGIMES.map((regime) => (
          <button
            key={regime}
            type="button"
            aria-pressed={shown.has(regime)}
            onClick={() => {
              toggle(regime);
            }}
            className="flex min-h-11 items-center gap-2 font-mono text-report-label text-foreground outline-none aria-[pressed=false]:text-label aria-[pressed=false]:line-through focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring"
          >
            <span
              aria-hidden="true"
              className={cn(
                'size-3 border border-foreground',
                shown.has(regime) ? TONE[regime] : 'bg-transparent',
              )}
            />
            {copy.regimes[regime]}
          </button>
        ))}
      </div>

      <div className="min-w-0">
        <p className="font-mono text-report-label uppercase text-foreground">{copy.aTitle}</p>
        <p className="mb-4 font-mono text-report-label uppercase text-label">{copy.aUnit}</p>
        <div className="relative ml-10 h-60" role="img" aria-label={copy.aLabel}>
          {TICKS.map((tick) => (
            <div
              key={tick}
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-chart-grid"
              style={{ bottom: `${String((tick / TOP) * 100)}%` }}
            >
              <span className="absolute right-full -translate-y-1/2 pr-2 font-mono text-report-label text-label tabular-nums">
                {tick}
              </span>
            </div>
          ))}
          <div className="absolute inset-0 flex items-end gap-px border-b border-chart-axis sm:gap-1">
            {data.quarters.map((one) => (
              <div
                key={one.quarter}
                className={cn(
                  'relative flex h-full flex-1 flex-col-reverse',
                  // A partial quarter: a dashed frame and paler bars, named in the line below.
                  one.partial &&
                    'outline-1 -outline-offset-1 outline-foreground outline-dashed [&>span]:opacity-50',
                )}
              >
                {REGIMES.map((regime) => (
                  <span
                    key={regime}
                    className={cn(
                      TONE[regime],
                      'block transition-[height] duration-100 motion-reduce:transition-none',
                    )}
                    style={{ height: `${String((one.values[regime] / TOP) * 100)}%` }}
                  />
                ))}
                {one.quarter.endsWith('Q1') ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-full left-0 pt-1 font-mono text-report-label text-label tabular-nums"
                  >
                    {one.quarter.slice(0, 4)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-8 min-h-5 font-mono text-report-label text-muted-foreground">
          {data.earlier > 0 ? copy.earlier.replace('{n}', number.format(data.earlier)) : null}
        </p>
        {partial === undefined ? null : (
          <p className="font-mono text-report-label text-muted-foreground">
            {copy.partial.replace('{q}', partial.quarter).replace('{date}', data.end)}
          </p>
        )}
        <ValuesTable
          head={[copy.quarter, ...visible.map((regime) => copy.regimes[regime])]}
          rows={data.quarters.map((one) => [
            one.partial
              ? copy.partialRow.replace('{q}', one.quarter).replace('{date}', data.end)
              : one.quarter,
            ...visible.map((regime) => number.format(one.values[regime])),
          ])}
        />
      </div>

      <div className="min-w-0">
        <p className="font-mono text-report-label uppercase text-foreground">{copy.bTitle}</p>
        <p className="mb-4 font-mono text-report-label uppercase text-label">{copy.bUnit}</p>
        <p className="mb-4 font-mono text-report-label text-foreground" aria-live="polite">
          {shown.size === 0 ? copy.none : copy.tankers.replace('{n}', number.format(data.tankers))}
        </p>
        <ul className="grid gap-y-3">
          {data.overlaps.map((group) => (
            <li
              key={group.regimes.join('+')}
              className="grid min-w-0 grid-cols-[minmax(0,10rem)_3.5rem_minmax(0,1fr)] items-center gap-x-3"
            >
              <span className="flex min-w-0 items-center gap-2 font-mono text-report-label text-foreground">
                <span aria-hidden="true" className="flex gap-0.5">
                  {group.regimes.map((regime) => (
                    <span key={regime} className={cn('size-2', TONE[regime])} />
                  ))}
                </span>
                <span className="break-words">{names(group.regimes)}</span>
              </span>
              <span className="text-right font-mono text-report-label text-foreground tabular-nums">
                {number.format(group.value)}
              </span>
              <span aria-hidden="true" className="relative h-4">
                <span
                  className="absolute inset-y-0 left-0 bg-foreground/60 transition-[width] duration-100 motion-reduce:transition-none"
                  style={{ width: `${String((group.value / all.tankers) * 100)}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
