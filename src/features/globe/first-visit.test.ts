import { afterEach, describe, expect, it, vi } from 'vitest';

import { keepFirstVisitClosed, readFirstVisitClosed } from './first-visit';

const memoryStorage = (): Pick<Storage, 'getItem' | 'setItem'> => {
  const held = new Map<string, string>();
  return {
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => void held.set(key, value),
  };
};

afterEach(() => vi.unstubAllGlobals());

describe('the first-visit card of the map', () => {
  it('shows on a visit that has no stored answer', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage() });
    expect(readFirstVisitClosed()).toBe(false);
  });

  it('does not come back after the reader closes it', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage() });
    keepFirstVisitClosed();
    expect(readFirstVisitClosed()).toBe(true);
  });

  it('shows again when the browser refuses storage, and never throws', () => {
    const refuse = () => {
      throw new Error('refused');
    };
    vi.stubGlobal('window', { localStorage: { getItem: refuse, setItem: refuse } });
    expect(keepFirstVisitClosed).not.toThrow();
    expect(readFirstVisitClosed()).toBe(false);
  });
});
