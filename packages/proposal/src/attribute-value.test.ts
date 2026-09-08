import { expect, test } from 'vitest';

import { attributeEdit } from './attribute-value.ts';

// THE SHAPE IS THE WHOLE RULE. M11 stands: no key allowlist, and no rule on a value beyond its
// shape. These tests hold the line in both directions — the first two prove the door takes a key
// and a value nobody described, and the last three prove it still refuses a malformed attribute.
const edit = attributeEdit();

const refusalOf = (given: unknown): { readonly code: string; readonly message: string } => {
  const held = edit.safeParse(given);
  if (held.success) throw new Error('the edit accepted attributes that it must refuse');
  const issue = held.error.issues[0];
  return { code: issue?.code ?? '', message: issue?.message ?? '' };
};

test('a key nobody described is accepted, in whatever kind its value has', () => {
  const given = {
    russian_designation: { v: 'v/ch 03333' },
    crew_aboard: { v: 41 },
    under_way: { v: true },
    port_calls: { v: ['Rotterdam', 'Hamburg'] },
  };
  expect(edit.parse(given)).toEqual(given);
});

// The key `imo` carries the shape of an IMO number in the seed, and no tier holds a value to it.
// A format is a description of a key and never a rule on a value.
test('a value that breaks the shape its key is described with is accepted', () => {
  const given = { imo: { v: '948213' } };
  expect(edit.parse(given)).toEqual(given);
});

test('a caller that cites a document is refused, and the writer alone composes a citation', () => {
  expect(refusalOf({ imo: { v: '9482137', src: ['doc_9b0417'] } }).code).toBe('unrecognized_keys');
});

test('an attribute that carries no value is refused', () => {
  expect(refusalOf({ imo: {} }).code).toBe('invalid_union');
});

test('a value that is an object is refused, because M7 leaves no depth in a value', () => {
  expect(refusalOf({ imo: { v: { number: '9482137' } } }).code).toBe('invalid_union');
});
