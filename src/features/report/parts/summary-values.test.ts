import { describe, expect, it } from 'vitest';
import { summaryValues } from './summary-values';

const first = (item: string) => {
  const [value] = summaryValues([item], [{ words: '' }]);
  return value?.kind === 'number' ? [value.value, value.format(value.value)] : value;
};

describe('the values of the summary', () => {
  it('reads a whole percentage', () => {
    expect(first('**Share:** about 84% of it')).toEqual([84, '84%']);
  });

  it('reads a percentage with decimals in the format of its locale', () => {
    expect(first('**Share:** about 2.6% of it')).toEqual([2.6, '2.6%']);
    expect(first('**Part :** environ 2,6 % de cela')).toEqual([2.6, '2,6 %']);
  });
});
