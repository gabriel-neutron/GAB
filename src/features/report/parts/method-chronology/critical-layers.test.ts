import { describe, expect, it } from 'vitest';
import { recordCounts } from '../../record-counts';
import { sources } from '../../source';
import { criticalLayers, readLayers } from './critical-layers';

describe('critical layers', () => {
  it('sums to the count of critical nodes of the final text', () => {
    const sum = [...criticalLayers.values()].reduce((total, one) => total + one, 0);
    expect([...criticalLayers.keys()]).toEqual(['Pay', 'Finance', 'Fight']);
    expect(sum).toBe(recordCounts(sources.en).critical);
  });

  it('refuses a count that is not a whole number', () => {
    expect(() => readLayers('layer,record,list_only\nPay,4.5,1')).toThrow(/not a count/);
  });
});
