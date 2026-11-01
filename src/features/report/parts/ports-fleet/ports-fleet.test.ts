import { describe, expect, it } from 'vitest';
import { parts } from '../../content';
import { chartLayout } from './chart-layout';
import { figureData } from './figure-data';
import { splitSentences } from './sentences';

const part = parts.find((one) => one.slug === 'ports-fleet');

describe('ports and fleet', () => {
  it('splits the paragraphs of the map scene into whole sentences that give the text back', () => {
    // The scene shows the paragraphs 1, 2 and 4 of the part: two, three and four sentences.
    for (const [index, count] of [
      [1, 2],
      [2, 3],
      [4, 4],
    ] as const) {
      const block = part?.blocks.at(index);
      const text = block?.text ?? '';
      expect(block?.kind).toBe('p');
      expect(splitSentences(text)).toHaveLength(count);
      expect(splitSentences(text).join(' ')).toBe(text);
    }
  });

  it('stacks the bands of a flow on their nodes at one scale', () => {
    const { nodes, bands } = chartLayout.sankey(
      [['a', 'b'], ['c']],
      [
        { from: 'a', to: 'c', value: 3 },
        { from: 'b', to: 'c', value: 1 },
      ],
      104,
      4,
    );
    expect(nodes.map((node) => [node.name, node.y, node.height])).toEqual([
      ['a', 0, 75],
      ['b', 79, 25],
      ['c', 0, 100],
    ]);
    expect(bands.map((band) => [band.from, band.y0, band.y1])).toEqual([
      ['a', 0, 0],
      ['b', 79, 75],
    ]);
  });

  it('moves close labels apart inside their range', () => {
    expect(chartLayout.spread([10, 12, 50], 10, 0, 100)).toEqual([10, 20, 50]);
    expect(chartLayout.spread([90, 95], 10, 0, 100)).toEqual([90, 100]);
    expect(chartLayout.spread([96, 99], 10, 0, 100)).toEqual([90, 100]);
  });

  it('reads the flows of figure 7 with each missing value kept missing', () => {
    const missing = figureData.flows.filter((row) => row.value === null);
    expect(missing.every((row) => row.state === 'not documented')).toBe(true);
  });
});
