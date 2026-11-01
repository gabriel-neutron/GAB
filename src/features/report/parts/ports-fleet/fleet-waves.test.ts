import { describe, expect, it } from 'vitest';
import { readWaves, REGIMES, selectWaves, type Regime } from './fleet-waves';

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

  it('marks as partial the one quarter that ends after the last designation', () => {
    const all = selectWaves(new Set(REGIMES));
    const partial = all.quarters.filter((one) => one.partial);
    expect(partial).toEqual([all.quarters.at(-1)]);
    expect(all.end.slice(0, 4)).toBe(partial[0]?.quarter.slice(0, 4));
  });

  it('shows no tanker when no regime shows', () => {
    const none = selectWaves(new Set());
    expect(none.tankers).toBe(0);
    expect(none.overlaps).toEqual([]);
  });
});

describe('readWaves', () => {
  const head = 'kind,key,regime,value\n';
  it('stops on a regime that is not EU, UK or OFAC', () => {
    expect(() => readWaves(`${head}combo,EU+OFCA,,6\n`)).toThrow(/OFCA/);
    expect(() => readWaves(`${head}quarter,2024-Q1,US,6\n`)).toThrow(/US/);
  });
  it('stops on a value that is not a count', () => {
    expect(() => readWaves(`${head}quarter,2024-Q1,EU,\n`)).toThrow(/count/);
    expect(() => readWaves(`${head}combo,EU,,1.5\n`)).toThrow(/count/);
  });
  it('stops when the date of the last designation is absent or in a bad form', () => {
    expect(() => readWaves(`${head}combo,EU,,1\n`)).toThrow(/date/);
    expect(() => readWaves(`${head}end,last designation,,8 October\n`)).toThrow(/date/);
  });
  it('stops on a quarter in a bad form', () => {
    expect(() => readWaves(`${head}quarter,2024-Q5,EU,3\n`)).toThrow(/quarter/);
  });
});
