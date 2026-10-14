// The key of the operator, with stubbed globals. They open no browser and no storage.

import { OPERATOR_KEY_HEADER } from '@gab/proposal/request';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { keepOperatorKey, operatorHeader } from './operator-key';

const KEY = 'k1-test-key-of-the-operator_0123456789ABCDEF';

const held = new Map<string, string>();
const replaceState = vi.fn();

const stubPage = (hash: string): void => {
  vi.stubGlobal('location', { hash, pathname: '/review', search: '?unit=3' });
  vi.stubGlobal('history', { replaceState });
};

beforeEach(() => {
  held.clear();
  replaceState.mockReset();
  vi.stubGlobal('localStorage', {
    getItem: (name: string) => held.get(name) ?? null,
    setItem: (name: string, value: string) => held.set(name, value),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('the key of the fragment is stored, and the fragment leaves the address', () => {
  stubPage(`#operator-key=${KEY}`);

  keepOperatorKey();

  expect(operatorHeader()).toStrictEqual({ [OPERATOR_KEY_HEADER]: KEY });
  expect(replaceState).toHaveBeenCalledExactlyOnceWith(null, '', '/review?unit=3');
});

test.each(['', '#top', '#operator-key=short', `#operator-key=${KEY}&x=1`])(
  'the fragment "%s" stores nothing and leaves the address alone',
  (hash) => {
    stubPage(hash);

    keepOperatorKey();

    expect(operatorHeader()).toStrictEqual({});
    expect(replaceState).not.toHaveBeenCalled();
  },
);

test('a page that holds no key sends no header', () => {
  expect(operatorHeader()).toStrictEqual({});
});

test('blocked storage raises nothing and sends no header', () => {
  const blocked = (): never => {
    throw new Error('blocked');
  };
  vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
  stubPage(`#operator-key=${KEY}`);

  expect(() => {
    keepOperatorKey();
  }).not.toThrow();
  expect(operatorHeader()).toStrictEqual({});
});
