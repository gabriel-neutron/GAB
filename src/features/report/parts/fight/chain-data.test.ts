import { describe, expect, it } from 'vitest';
import { fightUi, parts } from '../../content';
import {
  arcs,
  cellsOf,
  chainCount,
  flowLinks,
  placesOfNote,
  routeCounts,
  sites,
  stages,
  totalsAt,
} from './chain-data';
import { fitCrop, layoutFlow, placeLabels, ringHolds, stackLabels } from './layouts';

const fight = parts.find((part) => part.slug === 'fight');

describe('fight copy', () => {
  it('quotes the part verbatim and writes each value as its note does', () => {
    expect(fight?.blocks.map((block) => block.text).join(' ')).toContain(fightUi.quote);
    for (const one of fightUi.numbers)
      expect(fight?.notes.find((note) => note.id === one.note)?.text).toContain(one.value);
  });
});

describe('chain data', () => {
  it('fills 100 cells for each stage, and keeps the order of the shares', () => {
    expect(cellsOf([43.9, 41, 7, 8])).toEqual([44, 41, 7, 8]);
    expect(cellsOf([9.7, 68.9, 21.5])).toEqual([10, 69, 21]);
    for (const stage of stages)
      expect(stage.shares.reduce((sum, share) => sum + share.cells, 0)).toBe(100);
  });

  it('reads the places of a note, and leaves a name with no place off the map', () => {
    expect(
      placesOfNote('US 25.5, Taiwan 7.0, other coalition 5.4').map((p) => [p.name, p.value]),
    ).toEqual([
      ['United States', '25.5%'],
      ['Taiwan', '7.0%'],
    ]);
    expect(placesOfNote('China')[0]?.value).toBeUndefined();
  });

  it('gives each stage its document and page', () => {
    expect(stages.map((stage) => stage.name)).toEqual([
      'Brand (producer headquarters)',
      'Country of manufacture',
      'Final seller to Russia',
    ]);
    for (const stage of stages) expect(stage.document).not.toBe('');
  });

  it('keeps the counts of figure 11 and draws no arc to a name without a place', () => {
    expect(routeCounts.steps).toBe(Object.values(routeCounts.hops).reduce((a, b) => a + b, 0));
    expect(arcs.every((arc) => arc.from.name !== arc.to.name)).toBe(true);
    expect(totalsAt(2).length).toBeGreaterThan(0);
    expect(sites.every((site) => Number.isFinite(site.lat))).toBe(true);
  });
});

describe('layouts', () => {
  it('keeps a label off a reserved box', () => {
    const [free] = placeLabels([{ x: 50, y: 50, w: 20, h: 10 }], 100, 100);
    const [moved] = placeLabels([{ x: 50, y: 50, w: 20, h: 10 }], 100, 100, [
      { x: 55, y: 40, w: 45, h: 20 },
    ]);
    expect(free?.x).toBe(62);
    expect(moved).not.toBeNull();
    expect(moved?.x).not.toBe(62);
  });

  it('places labels clear of each other and of the edge, or leaves them out', () => {
    const boxes = placeLabels(
      [
        { x: 50, y: 50, w: 40, h: 14 },
        { x: 52, y: 50, w: 40, h: 14 },
        { x: 98, y: 2, w: 40, h: 14 },
      ],
      100,
      100,
    );
    const [a, b] = boxes;
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    if (a && b)
      expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(
        true,
      );
    for (const box of boxes)
      if (box) expect(box.x >= 0 && box.x + box.w <= 100 && box.y >= 0).toBe(true);
  });

  it('stacks the flow of figure 11 on one scale, with every chain in each column', () => {
    const { nodes, bands } = layoutFlow(flowLinks, 400, 4);
    const columns = [0, 1, 2, 3].map((column) =>
      nodes.filter((node) => node.column === column).reduce((sum, node) => sum + node.value, 0),
    );
    for (const total of columns) expect(total).toBeCloseTo(routeCounts.chains, 2);
    expect(bands).toHaveLength(flowLinks.length);
    expect(Math.max(...nodes.map((node) => node.y + node.h))).toBeLessThanOrEqual(400.001);
    expect(chainCount(13.0001)).toBe('13');
  });
});

describe('map helpers', () => {
  it('stacks labels near their points with no overlap and inside the box', () => {
    expect(stackLabels([50, 52, 51], 10, 200)).toEqual([45, 65, 55]);
    expect(stackLabels([195, 196], 10, 200)).toEqual([180, 190]);
  });

  it('tells a point inside a ring from a point outside', () => {
    const square = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];
    expect(ringHolds(square, 5, 5)).toBe(true);
    expect(ringHolds(square, 15, 5)).toBe(false);
  });

  it('fits a crop to the box at one scale, and caps the latitudes', () => {
    const tall = fitCrop({ west: 0, east: 40, south: 50, north: 60 }, 400, 400);
    expect(tall.east - tall.west).toBeCloseTo(tall.north - tall.south);
    expect(tall.h).toBe(400);
    const wide = fitCrop({ west: -100, east: 140, south: 0, north: 60 }, 300, 600);
    expect(wide.north - wide.south).toBe(150);
    expect(wide.north).toBeLessThanOrEqual(84);
    expect(wide.h).toBeCloseTo(187.5);
  });
});
