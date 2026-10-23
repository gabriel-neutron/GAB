import { describe, expect, test } from 'vitest';

import { choices, filterRows, NO_FILTER, toCsv, type DataRow } from './data-rows';

const row = (id: string, kind: string, decider: string, ...cells: string[]): DataRow => ({
  id,
  kind,
  decider,
  cells: [id, ...cells],
});

const ROWS = [
  row('1', 'vessel', 'Accepted by an AI reviewer — no person read it', 'Skadi'),
  row('2', 'company', 'Validated manually by the operator', 'Société Générale'),
  row('3', 'vessel', 'Validated manually by the operator', 'Afkada'),
];

describe('filterRows', () => {
  test('no filter keeps each row', () => {
    expect(filterRows(ROWS, NO_FILTER)).toHaveLength(3);
  });

  test('the kind, the decider and the text all have to match', () => {
    expect(filterRows(ROWS, { kind: 'vessel', decider: '', text: '' }).map((r) => r.id)).toEqual([
      '1',
      '3',
    ]);
    expect(
      filterRows(ROWS, { kind: 'vessel', decider: 'Validated manually by the operator', text: '' }),
    ).toHaveLength(1);
    expect(filterRows(ROWS, { kind: '', decider: '', text: 'societe generale' })).toHaveLength(1);
  });
});

describe('choices', () => {
  test('lists each value once, in order', () => {
    expect(choices(ROWS, 'kind')).toEqual(['company', 'vessel']);
  });
});

describe('toCsv', () => {
  test('writes the disclaimer, the header and the quoted rows', () => {
    const csv = toCsv(
      'About this data.\n\nA line.',
      ['id', 'label'],
      [{ id: '1', kind: 'k', decider: 'd', cells: ['1', 'Say "hi", now'] }],
    );
    expect(csv).toBe(
      `${String.fromCharCode(0xfeff)}# About this data.\n#\n# A line.\nid,label\n1,"Say ""hi"", now"\n`,
    );
  });
});
