import { readFileSync } from 'node:fs';

import { expect, test } from 'vitest';

import { published, rebuild, type NodeFacts } from './critical-nodes-replay.ts';

// Ten invented nodes: a snapshot of the facts that the SQL of the script gives, not the record.
const facts = JSON.parse(
  readFileSync(new URL('./fixtures/critical-nodes-snapshot.json', import.meta.url), 'utf8'),
) as NodeFacts[];

test('rebuilds the counts of the stated rule from a committed snapshot', () => {
  expect(rebuild(facts)).toEqual({ nodes: 10, a: 6, b: 5, c: 6, all3: 2, atLeast2: 5 });
});

test('reads the published split of the data file of the report', () => {
  const csv = readFileSync(
    new URL('../src/features/report/data/critical-layers.csv', import.meta.url),
    'utf8',
  );
  expect(published(csv)).toEqual({ record: 450, listOnly: 43 });
});
