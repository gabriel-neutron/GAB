import { expect, test } from 'vitest';

import type { AttributeValue } from '@/shared/read/model';

import { readClaims } from './claims';
import type { RecordRow } from './dossier';
import { pendingEdit, typedInto } from './draft';
import { readEntry, readUndeclaredValue } from './entry';

const controlOfTyped = (typed: string) => readUndeclaredValue(typed).control;

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

test('a digit string that a double cannot hold exactly reads as text', () => {
  expect(controlOfTyped('40702810123456789012')).toBe('text');
  expect(controlOfTyped('9007199254740993')).toBe('text');
  expect(readUndeclaredValue('40702810123456789012').entry).toStrictEqual({
    held: true,
    value: '40702810123456789012',
  });
});

test('a decimal that a double holds exactly reads as a number', () => {
  expect(controlOfTyped('41.5')).toBe('number');
  expect(controlOfTyped('41.50')).toBe('number');
  expect(controlOfTyped('-3')).toBe('number');
  expect(controlOfTyped('9007199254740992')).toBe('number');
});

test('a leading zero, an exponent and a second point read as text', () => {
  expect(controlOfTyped('007')).toBe('text');
  expect(controlOfTyped('1e5')).toBe('text');
  expect(controlOfTyped('-0.5.')).toBe('text');
});

test('a number cell refuses a number it cannot hold exactly, and rounds nothing', () => {
  expect(readEntry({ control: 'number' }, '40702810123456789012').held).toBe(false);
  expect(readEntry({ control: 'number' }, '41.50')).toStrictEqual({ held: true, value: 41.5 });
});

test('a list with a blank inside is refused, and a trailing comma is dropped', () => {
  expect(readEntry(storedOf(['GB', 'NO']), 'GB,,NO').held).toBe(false);
  expect(readEntry(storedOf(['GB', 'NO']), 'GB, NO,')).toStrictEqual({
    held: true,
    value: ['GB', 'NO'],
  });
});
