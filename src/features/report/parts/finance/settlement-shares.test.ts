import { describe, expect, it } from 'vitest';
import raw from '../../data/currencies.csv?raw';
import { readCsv } from '../../line-panel';
import { settlementShare } from './settlement-shares';

const rows = readCsv(raw);
const panelOf = (series: string) =>
  series === 'settlement_currency_exports' ? 'exports' : 'imports';
const KEYS = ['Rouble', 'Other currencies', '“Unfriendly” currencies'];

describe('settlementShare', () => {
  it('gives the share of each group of currencies of each year of the currencies data', () => {
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const series = row['series'] ?? '';
      const key = row['key'] ?? '';
      const year = row['year'] ?? '';
      expect(settlementShare(panelOf(series), key, Number(year)), `${series} ${key} ${year}`).toBe(
        Number(row['value']),
      );
    }
  });

  it('gives three shares that add up to the total in each year', () => {
    for (const row of rows.filter((one) => one['key'] === 'Rouble')) {
      const panel = panelOf(row['series'] ?? '');
      const year = Number(row['year']);
      const total = KEYS.map((key) => settlementShare(panel, key, year) ?? 0).reduce(
        (sum, one) => sum + one,
        0,
      );
      expect(total).toBeCloseTo(100, 0);
    }
  });

  it('gives no share for a year out of the data', () => {
    expect(settlementShare('exports', 'Rouble', 2018)).toBeUndefined();
  });
});
