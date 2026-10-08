import { expect, test } from 'vitest';

import { decide, type KnownAuthor, type RatingAnswer } from './answer.ts';

const author = (name: string, letter: string, extra: Partial<KnownAuthor> = {}): KnownAuthor => ({
  name,
  letter,
  reason: 'a reason',
  controller: null,
  party: false,
  reference: true,
  names: [],
  ...extra,
});

const AUTHORS = [
  author('reuters', 'B', { names: ['reuters news'] }),
  author('state register', 'A'),
  author('trade journal', 'D', { reference: false }),
];

const rating = (extra: Partial<Extract<RatingAnswer, { kind: 'new' }>> = {}): RatingAnswer => ({
  kind: 'new',
  letter: 'C',
  reason: ' it reports as an agency does ',
  references: ['Reuters'],
  controller: null,
  party: false,
  ...extra,
});

test('the same author joins the name to a known author, even by another name of it', () => {
  expect(decide('Reuters Wire', { kind: 'same', as: ' Reuters  News ' }, AUTHORS)).toStrictEqual({
    kind: 'join',
    known: 'reuters',
  });
});

test('a join to a name that no known author holds is refused', () => {
  expect(decide('X', { kind: 'same', as: 'Nobody' }, AUTHORS)).toMatchObject({ kind: 'refused' });
});

test('a valid rating keeps the letter, the reason, the compared authors and the controller', () => {
  expect(
    decide(
      'Channel X',
      rating({ letter: 'E', references: ['REUTERS', 'state register'], controller: ' A Holding ' }),
      AUTHORS,
    ),
  ).toStrictEqual({
    kind: 'store',
    letter: 'E',
    reason: 'it reports as an agency does',
    references: ['reuters', 'state register'],
    controller: 'A Holding',
    party: false,
  });
});

test('a party with a controller is a valid rating', () => {
  expect(
    decide('Ministry', rating({ party: true, controller: 'The State' }), AUTHORS),
  ).toMatchObject({ kind: 'store', party: true, controller: 'The State' });
});

test.each(['A', 'B'] as const)('the letter %s is refused', (letter) => {
  expect(decide('X', rating({ letter }), AUTHORS)).toMatchObject({
    kind: 'refused',
    reason: expect.stringContaining('A and B come from the reference set') as unknown,
  });
});

test('a rating that names no reference author is refused', () => {
  expect(decide('X', rating({ references: [] }), AUTHORS)).toMatchObject({
    kind: 'refused',
    reason: expect.stringContaining('no reference author') as unknown,
  });
});

test('a rating that compares with an author outside the reference set is refused', () => {
  expect(decide('X', rating({ references: ['Trade Journal'] }), AUTHORS)).toMatchObject({
    kind: 'refused',
  });
});

test('a party with no controller is refused', () => {
  for (const controller of [null, '  '])
    expect(decide('X', rating({ party: true, controller }), AUTHORS)).toMatchObject({
      kind: 'refused',
      reason: expect.stringContaining('no controller') as unknown,
    });
});

test('a rating with a blank reason is refused', () => {
  expect(decide('X', rating({ reason: '  ' }), AUTHORS)).toMatchObject({ kind: 'refused' });
});
