import { expect, test } from 'vitest';

import { isNotReady } from './db-runtime.ts';

const withCode = (code: string): Error => Object.assign(new Error(code), { code });

test.each(['ECONNREFUSED', 'ECONNRESET', '57P03'])(
  'the code %s means the server starts',
  (code) => {
    expect(isNotReady(withCode(code))).toBe(true);
  },
);

test('a cut connection means the server starts', () => {
  expect(isNotReady(new Error('Connection terminated unexpectedly'))).toBe(true);
});

test.each(['28P01', '3D000', '28000', 'ENOTFOUND'])(
  'the code %s stops the wait at once',
  (code) => {
    expect(isNotReady(withCode(code))).toBe(false);
  },
);
