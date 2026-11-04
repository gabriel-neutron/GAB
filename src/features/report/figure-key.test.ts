import { describe, expect, it } from 'vitest';
import { figureTexts } from './content';
import { figureKey } from './figure-key';

const labelsOf = (number: number): Readonly<Record<string, string>> => {
  const key = figureKey(number);
  const figures: Readonly<Partial<Record<string, { readonly labels: Record<string, string> }>>> =
    figureTexts.figures;
  return key === undefined ? {} : (figures[key]?.labels ?? {});
};

describe('the key of the figure texts', () => {
  it('gives the timeline to figure 1 and the layers to figure 2', () => {
    expect(Object.keys(labelsOf(1))).toContain('Union européenne');
    expect(Object.keys(labelsOf(2))).toContain('Payer');
  });

  it('gives the key that the figures of the page read', () => {
    expect([9, 10, 11, 12].map(figureKey)).toEqual([undefined, '9', '10', '12']);
  });
});
