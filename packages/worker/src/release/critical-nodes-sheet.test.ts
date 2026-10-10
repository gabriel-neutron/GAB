import { readFileSync } from 'node:fs';

import { expect, test } from 'vitest';

import { CriticalNodesSheetFault, readCriticalNodesSheet } from './critical-nodes-sheet.ts';

const NODE = '00000000-0000-4000-8000-00000000e001';
const HEADER = 'node_id,condition,claim_ids,controller,bypass_pattern';

test('the example sheet gives one row for each candidate node and condition', () => {
  const text = readFileSync(new URL('../../fixtures/critical-nodes.csv', import.meta.url), 'utf8');
  const rows = readCriticalNodesSheet(text);
  expect(rows.map((row) => [row.line, row.condition, row.claimIds.length])).toStrictEqual([
    [3, 'b', 1],
    [4, 'c', 2],
    [5, 'b', 0],
    [6, null, 0],
  ]);
  expect(rows[0]).toMatchObject({
    nodeId: NODE,
    controller: 'TEST OWNER LTD',
    bypassPattern: 'Ship-to-ship transfer off an invented port, then a new flag',
  });
});

test('the columns come in any order, a spreadsheet mark and a condition in brackets are read', () => {
  const rows = readCriticalNodesSheet(
    `\uFEFFclaim_ids,bypass_pattern,controller,condition,node_id\r\n x/y  z ,,Someone,(C),${NODE.toUpperCase()}\r\n`,
  );
  expect(rows).toStrictEqual([
    {
      line: 2,
      nodeId: NODE,
      condition: 'c',
      claimIds: ['x/y', 'z'],
      controller: 'Someone',
      bypassPattern: '',
    },
  ]);
});

test.each([
  ['', /no header/u],
  [
    `node_id,condition,claim_ids,controller\n${NODE},b,,x`,
    /Line 1: give the column bypass_pattern/u,
  ],
  [`${HEADER},note\n`, /Line 1: the column "note" is not known/u],
  [`${HEADER}\n${NODE},a,x,,`, /Line 2: condition \(a\) comes from the designations/u],
  [`${HEADER}\n${NODE},d,,,`, /Line 2: give the condition b, c or nothing/u],
  [`${HEADER}\nnot-an-id,b,,,`, /Line 2: give the entity identifier/u],
  [`${HEADER}\n${NODE},,x,,`, /Line 2: a row with claim identifiers gives its condition/u],
  [`${HEADER}\n${NODE},b,,\n`, /Line 2: give 5 fields, not 4/u],
  [
    `${HEADER}\n# a note\n${NODE},b,x,,\n${NODE},b,y,,`,
    /Line 4: the node .* condition \(b\) already/u,
  ],
  [`${HEADER}\n${NODE},b,"x,,`, /not a valid CSV file/u],
])('the sheet %j is refused', (text, message) => {
  expect(() => readCriticalNodesSheet(text)).toThrow(CriticalNodesSheetFault);
  expect(() => readCriticalNodesSheet(text)).toThrow(message);
});
