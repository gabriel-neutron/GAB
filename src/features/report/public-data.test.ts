import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import edges from './edges-data';
import nodes from './nodes-data';

// The dataset that a reader downloads must hold the same nodes and edges as the page.
const published = (name: string): unknown =>
  JSON.parse(
    readFileSync(new URL(`../../../public/report-data/${name}.json`, import.meta.url), 'utf8'),
  );

describe('the published node data', () => {
  it('holds the nodes and the edges of the page', () => {
    expect(published('nodes')).toEqual(nodes);
    expect(published('edges')).toEqual(edges);
  });
});
