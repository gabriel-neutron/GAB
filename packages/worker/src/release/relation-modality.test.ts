import { expect, test } from 'vitest';

import { DataFault } from './tanker-port-calls.ts';
import { imoList, modalityLines, type OwnsRow } from './relation-modality.ts';

test('the IMO list needs the header imo, skips comments and refuses a wrong line', () => {
  expect(imoList('\uFEFF# note\nimo\n9000001\n 9000002 \n')).toEqual(['9000001', '9000002']);
  expect(() => imoList('9000001\n')).toThrow(DataFault);
  expect(() => imoList('imo\n12345\n')).toThrow(DataFault);
});

const row = (over: Partial<OwnsRow>): OwnsRow => ({
  imo: '9000001',
  vessel: 'ALPHA',
  owner: 'Alpha LLC',
  relation: 'r1',
  originator: 'host:war-sanctions.gur.gov.ua',
  modalities: ['asserts'],
  sources: ['doc_1'],
  ...over,
});

test('each listed IMO gives one line per owns relation, or a line that says there is none', () => {
  const lines = modalityLines(
    ['9000001', '9000002'],
    [row({}), row({ relation: 'r2', modalities: ['asserts', 'enacts'] })],
  );
  expect(lines).toEqual([
    '9000001\tALPHA\tAlpha LLC\tr1\tasserts\thost:war-sanctions.gur.gov.ua\tdoc_1',
    '9000001\tALPHA\tAlpha LLC\tr2\tasserts,enacts\thost:war-sanctions.gur.gov.ua\tdoc_1',
    '9000002\t-\t-\t-\tno owns relation\t-\t-',
  ]);
});

test('a relation with no citation or no originator prints a dash, and a modality is never invented', () => {
  expect(modalityLines(['9000001'], [row({ modalities: [], originator: null })])).toEqual([
    '9000001\tALPHA\tAlpha LLC\tr1\tno citation\t-\tdoc_1',
  ]);
});
