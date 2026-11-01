import { describe, expect, it } from 'vitest';
import { readout, type ChartSpec, type LineSeries } from './line-chart';
import { monthName, payData, type Point } from './pay-data';

const spec = (series: LineSeries[], unit: string, xName: (x: number) => string, digits = 0) =>
  ({
    label: '',
    unit,
    x: [0, 1],
    y: [0, 1],
    xTicks: [],
    yTicks: [],
    series,
    xName,
    digits,
  }) satisfies ChartSpec;
const line = (id: string, points: readonly Point[], shown = true): LineSeries => ({
  id,
  label: id,
  tone: 'ink',
  points,
  shown,
});
// The first x where every series has a value.
const common = (series: readonly LineSeries[]) =>
  series[0]?.points.find(
    (p) => p !== null && series.every((s) => s.points.some((q) => q?.x === p.x)),
  )?.x ?? NaN;
const at = (points: readonly Point[], x: number) => points.find((p) => p?.x === x)?.y ?? NaN;

describe('the read-out of a line chart', () => {
  it('gives the year and each value with its unit on figure 3', () => {
    const series = payData.f3a.map((row) => line(row.key, row.points));
    const x = common(series);
    const out = readout(spec(series, 'USD bn', String), x);
    expect(out.name).toBe(String(x));
    expect(out.rows).toHaveLength(series.length);
    expect(out.rows[0]).toBe(
      `${series[0]?.id ?? ''}: ${at(series[0]?.points ?? [], x).toFixed(0)} USD bn`,
    );
  });

  it('gives the month and both prices on figure 4', () => {
    const series = [line('Brent', payData.f4.brent), line('Urals', payData.f4.urals)];
    const x = common(series);
    const out = readout(spec(series, '$/bbl', monthName, 1), x);
    expect(out.name).toBe(monthName(x));
    expect(out.rows).toEqual([
      `Brent: ${at(payData.f4.brent, x).toFixed(1)} $/bbl`,
      `Urals: ${at(payData.f4.urals, x).toFixed(1)} $/bbl`,
    ]);
    // A month with no Urals price gives the Brent row only.
    const gap = payData.f4.brent.find((p) => p !== null && Number.isNaN(at(payData.f4.urals, p.x)));
    expect(gap).toBeDefined();
    expect(readout(spec(series, '$/bbl', monthName, 1), gap?.x ?? NaN).rows).toHaveLength(1);
  });

  it('skips a hidden series on figure 5', () => {
    const series = [line('share', payData.f5.share), line('hidden', payData.f5.share9, false)];
    const x = common(series);
    expect(readout(spec(series, '%', String, 1), x).rows).toEqual([
      `share: ${at(payData.f5.share, x).toFixed(1)} %`,
    ]);
  });
});
