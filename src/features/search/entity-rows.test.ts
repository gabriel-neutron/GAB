import { describe, expect, it } from 'vitest';

import { commonKeys, csvOf, filterRows, jsonOf, sortRows, type EntityRow } from './entity-rows';

const row = (id: string, label: string, type: string, sources: number, values = {}): EntityRow => ({
  id,
  label,
  type,
  sources,
  values,
});

const rows = [
  row('a', 'Beta Ltd', 'company', 2, { tonnage: '10', flag: 'Cyprus' }),
  row('b', 'Alpha, "Co"', 'company', 0, { tonnage: '9' }),
  row('c', 'Émile', 'person', 5),
];

describe('entity rows', () => {
  it('filters by folded text and by type', () => {
    expect(filterRows(rows, 'emile', null).map((one) => one.id)).toEqual(['c']);
    expect(filterRows(rows, '', 'company').map((one) => one.id)).toEqual(['a', 'b']);
    expect(filterRows(rows, 'zzz', null)).toEqual([]);
  });

  it('sorts both ways and puts an absent value last', () => {
    const ids = (
      key: 'label' | 'sources' | 'attr:tonnage',
      direction: 'ascending' | 'descending',
    ) => sortRows(rows, { key, direction }).map((one) => one.id);
    expect(ids('label', 'ascending')).toEqual(['b', 'a', 'c']);
    expect(ids('sources', 'descending')).toEqual(['c', 'a', 'b']);
    expect(ids('attr:tonnage', 'ascending')).toEqual(['b', 'a', 'c']);
    expect(ids('attr:tonnage', 'descending')).toEqual(['a', 'b', 'c']);
  });

  it('writes CSV with quoted fields and blank absent values', () => {
    expect(csvOf(rows, ['flag'])).toBe(
      'id,name,type,documents,flag\r\na,Beta Ltd,company,2,Cyprus\r\nb,"Alpha, ""Co""",company,0,\r\nc,Émile,person,5,\r\n',
    );
  });

  it('keeps a spreadsheet from running a label as a formula', () => {
    const risky = [row('x', '=HYPERLINK("a")', 'company', 1, { tonnage: '-5' })];
    expect(csvOf(risky, ['tonnage'])).toBe(
      `id,name,type,documents,tonnage\r\nx,"'=HYPERLINK(""a"")",company,1,-5\r\n`,
    );
  });

  it('names the most common keys and writes JSON', () => {
    expect(commonKeys(rows, 1)).toEqual(['tonnage']);
    expect(JSON.parse(jsonOf(rows.slice(0, 1)))).toEqual([rows[0]]);
  });
});
