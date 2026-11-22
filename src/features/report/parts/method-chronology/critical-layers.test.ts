import { describe, expect, it } from 'vitest';
import { recordCounts } from '../../record-counts';
import { sources } from '../../source';
import { criticalLayers, readLayers } from './critical-layers';

const HEAD = 'layer,record,list_only,date';

describe('critical layers', () => {
  it('sums to the count of critical nodes of the final text', () => {
    const sum = [...criticalLayers.values()].reduce((total, one) => total + one, 0);
    expect([...criticalLayers.keys()]).toEqual(['Pay', 'Finance', 'Fight']);
    expect(sum).toBe(recordCounts(sources.en).critical);
  });

  it('refuses a bad count, an empty or repeated layer and a row with no date', () => {
    expect(() => readLayers(`${HEAD}\nPay,4.5,1,2026-10-27`)).toThrow(/not a count/);
    expect(() => readLayers(`${HEAD}\nPay,1,1,2026-10-27\nPay,1,1,2026-10-27`)).toThrow(/repeated/);
    expect(() => readLayers(`${HEAD}\n,1,1,2026-10-27`)).toThrow(/empty/);
    expect(() => readLayers(`${HEAD}\nPay,1,1,`)).toThrow(/no date/);
  });
});
