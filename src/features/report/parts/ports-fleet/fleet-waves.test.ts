import { describe, expect, it } from 'vitest';
import { REGIMES, selectWaves, type Regime } from './fleet-waves';

const sum = (values: readonly number[]) => values.reduce((total, one) => total + one, 0);

describe('selectWaves', () => {
  it('keeps every combination of the data when all regimes show', () => {
    const all = selectWaves(new Set(REGIMES));
    expect(all.overlaps.map((one) => one.regimes.join('+'))).toContain('EU+UK+OFAC');
    expect(all.tankers).toBe(sum(all.overlaps.map((one) => one.value)));
    expect(all.overlaps).toHaveLength(7);
  });

  it('keeps the number of tankers of each regime exact when other regimes hide', () => {
    const all = selectWaves(new Set(REGIMES));
    const listedBy = (regime: Regime, overlaps: typeof all.overlaps) =>
      sum(overlaps.filter((one) => one.regimes.includes(regime)).map((one) => one.value));
    const two = selectWaves(new Set(['EU', 'UK']));
    // Each tanker is in one group only, and a tanker of OFAC alone leaves the count.
    expect(two.overlaps.map((one) => one.regimes.join('+')).sort()).toEqual(['EU', 'EU+UK', 'UK']);
    expect(listedBy('EU', two.overlaps)).toBe(listedBy('EU', all.overlaps));
    expect(listedBy('UK', two.overlaps)).toBe(listedBy('UK', all.overlaps));
    const ofacOnly = all.overlaps.find((one) => one.regimes.join('+') === 'OFAC')?.value ?? 0;
    expect(two.tankers).toBe(all.tankers - ofacOnly);
  });

  it('draws the quarters of the shown regimes only', () => {
    const all = selectWaves(new Set(REGIMES));
    const eu = selectWaves(new Set(['EU']));
    expect(eu.quarters.map((one) => one.quarter)).toEqual(all.quarters.map((one) => one.quarter));
    expect(eu.quarters.every((one) => one.values.UK === 0 && one.values.OFAC === 0)).toBe(true);
    expect(sum(eu.quarters.map((one) => one.values.EU))).toBe(
      sum(all.quarters.map((one) => one.values.EU)),
    );
    expect(eu.earlier).toBe(0);
    expect(selectWaves(new Set(['OFAC'])).earlier).toBe(all.earlier);
  });

  it('shows no tanker when no regime shows', () => {
    const none = selectWaves(new Set());
    expect(none.tankers).toBe(0);
    expect(none.overlaps).toEqual([]);
  });
});
