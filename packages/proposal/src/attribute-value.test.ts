import { expect, test } from 'vitest';

import { attributeEdit } from './attribute-value.ts';
import { ATTRIBUTE_KIND, type AttributeVocabulary } from './vocabulary.ts';

// The five declarations below stand for the live rows of `attribute_key`, one per rule the
// edit applies: a kind that holds a number, one that holds a word, a format and a retirement.
const VOCABULARY: AttributeVocabulary = [
  { key: 'imo', kind: ATTRIBUTE_KIND.identifier, pattern: '^[0-9]{7}$', retired: false },
  { key: 'coal_stock_t', kind: ATTRIBUTE_KIND.quantity, pattern: null, retired: false },
  { key: 'is_dark_fleet', kind: ATTRIBUTE_KIND.boolean, pattern: null, retired: false },
  { key: 'aliases', kind: ATTRIBUTE_KIND.list, pattern: null, retired: false },
  { key: 'call_sign', kind: ATTRIBUTE_KIND.text, pattern: null, retired: true },
];

const edit = attributeEdit(VOCABULARY);

type Edit = ReturnType<typeof attributeEdit>;

const refusedBy = (
  schema: Edit,
  given: unknown,
): { readonly code: string; readonly message: string } => {
  const held = schema.safeParse(given);
  if (held.success) throw new Error('the edit accepted attributes that it must refuse');
  const issue = held.error.issues[0];
  return { code: issue?.code ?? '', message: issue?.message ?? '' };
};

const refusalOf = (given: unknown): { readonly code: string; readonly message: string } =>
  refusedBy(edit, given);

test('an edit of a declared key, in the kind and the format the key states, is accepted', () => {
  const given = {
    imo: { v: '9482137' },
    coal_stock_t: { v: 41200 },
    is_dark_fleet: { v: true },
    aliases: { v: ['Northern Ledger', 'Nordic Ledger'] },
  };
  expect(edit.parse(given)).toEqual(given);
});

test('a caller that cites a document is refused, and the writer alone composes a citation', () => {
  expect(refusalOf({ imo: { v: '9482137', src: ['doc_9b0417'] } }).code).toBe('unrecognized_keys');
});

test('a key that the database does not declare is refused by that name', () => {
  expect(refusalOf({ berth_count: { v: 2 } }).message).toBe('berth_count is not a declared key');
});

test('a key that the database retired is refused by that name', () => {
  expect(refusalOf({ call_sign: { v: 'PBNL' } }).message).toBe('call_sign is retired');
});

test('a value of the wrong kind is refused, and the sentence names the kind the key states', () => {
  expect(refusalOf({ imo: { v: 9482137 } }).message).toBe(
    'the value of imo is not identifier, which the key declares',
  );
});

test('a value that breaks the format is refused, and the sentence states the format', () => {
  expect(refusalOf({ imo: { v: '948213' } }).message).toBe(
    'imo does not match the format ^[0-9]{7}$',
  );
});

test('a format applies to each element of a list, and one bad element refuses the edit', () => {
  const shaped = attributeEdit([
    { key: 'imo_list', kind: ATTRIBUTE_KIND.list, pattern: '^[0-9]{7}$', retired: false },
  ]);
  expect(refusedBy(shaped, { imo_list: { v: ['9482137', '948213'] } }).message).toBe(
    'imo_list does not match the format ^[0-9]{7}$',
  );
  expect(shaped.safeParse({ imo_list: { v: ['9482137', '9482138'] } }).success).toBe(true);
});
