import { expect, test } from 'vitest';

import type { AttributeValue } from '@/shared/read/model';

import { readClaims } from './claims';
import type { RecordRow } from './dossier';
import { pendingEdit, typedInto } from './draft';
import { readEntry } from './entry';

const rowsOf = (key: string, v: AttributeValue): readonly RecordRow[] =>
  readClaims({ [key]: { v, src: ['doc_1'] } }).map((claim) => ({
    key: claim.key,
    kind: 'claim',
    claim,
    sources: [],
  }));

const storedOf = (v: AttributeValue) => {
  const row = rowsOf('stored', v)[0];
  if (row === undefined) throw new Error('readClaims gave no row');
  return row.claim.value;
};

test('a stored list of numbers reads its typed elements back as numbers', () => {
  const read = readEntry(storedOf([2019, 2021]), '2019, 2021, 2023');
  expect(read).toStrictEqual({ held: true, value: [2019, 2021, 2023] });
});

test('a stored list of numbers refuses an element that is not a number', () => {
  const read = readEntry(storedOf([2019, 2021]), '2019, 2021, soon');
  expect(read.held).toBe(false);
});

test('a stored list of texts keeps a typed digit element as text', () => {
  const read = readEntry(storedOf(['7', 'B']), '7, B, 9');
  expect(read).toStrictEqual({ held: true, value: ['7', 'B', '9'] });
});

test('a stored list with a comma inside an element refuses an edit, and splits nothing', () => {
  const rows = rowsOf('aliases', ['Smith, John', 'J. Smith']);
  const drafts = typedInto(rows, new Map(), 'aliases', 'Smith, John, J. Smith, Ivan Smith');
  expect(drafts.get('aliases')?.refusal).not.toBeNull();
  expect(pendingEdit(rows, drafts).ready).toBe(false);
});

test('a list typed back to its stored text stands at the stored value, with no refusal', () => {
  const rows = rowsOf('aliases', ['Smith, John', 'J. Smith']);
  const typed = typedInto(rows, new Map(), 'aliases', 'Smith, John, J. Smith, Ivan Smith');
  const back = typedInto(rows, typed, 'aliases', 'Smith, John, J. Smith');
  expect(back.has('aliases')).toBe(false);
});
