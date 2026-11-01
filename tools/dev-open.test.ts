import { expect, test } from 'vitest';

import { openWithKey, operatorKeyIn } from './dev-open.ts';

const KEY = 'k1-test-key-of-the-operator_0123456789ABCDEF';
const LINE = `GABRIEL_OPERATOR_KEY=${KEY}\n`;

test('the page opens with the key in the fragment for pnpm dev', () => {
  expect(openWithKey(LINE, 'dev')).toBe(`/#operator-key=${KEY}`);
});

test.each(['test', 'preview', undefined])('the lifecycle %s opens no browser', (lifecycle) => {
  expect(openWithKey(LINE, lifecycle)).toBe(false);
});

test('a byte order mark does not hide the first line', () => {
  expect(operatorKeyIn(String.fromCodePoint(0xfeff) + LINE)).toBe(KEY);
});

test.each([undefined, '', 'OTHER=1\n', 'GABRIEL_OPERATOR_KEY=\n', 'GABRIEL_OPERATOR_KEY=   \n'])(
  'a missing file or a blank value gives no key (%j)',
  (text) => {
    expect(operatorKeyIn(text)).toBeUndefined();
    expect(openWithKey(text, 'dev')).toBe(false);
  },
);
