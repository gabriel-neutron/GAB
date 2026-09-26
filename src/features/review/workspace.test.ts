import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeWorkspace } from '@/shared/storage';

import { patchOpenRecord, patchSort, readOpenRecord, readSort } from './workspace';

const storeInMemory = () => {
  const held = new Map<string, string>();
  return {
    getItem: (key: string): string | null => held.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      held.set(key, value);
    },
  };
};

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: storeInMemory() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the two writers of the review workspace', () => {
  it('keeps the order when the node pane folds the record', () => {
    patchSort('name');
    patchOpenRecord(false);
    expect(readSort()).toBe('name');
    expect(readOpenRecord()).toBe(false);
  });

  it('keeps the fold when the route changes the order', () => {
    patchOpenRecord(false);
    patchSort('oldest');
    expect(readOpenRecord()).toBe(false);
    expect(readSort()).toBe('oldest');
  });
});

describe('the fallbacks of the review workspace', () => {
  it('gives the weakest first and an open record when nothing is stored', () => {
    expect(readSort()).toBe('confidence');
    expect(readOpenRecord()).toBe(true);
  });

  it('gives the weakest first for an order the code does not know', () => {
    writeWorkspace('review', { sort: 'bogus' });
    expect(readSort()).toBe('confidence');
  });

  it('gives an open record for a fold that is not a boolean', () => {
    writeWorkspace('review', { openRecord: 'no' });
    expect(readOpenRecord()).toBe(true);
  });

  it('gives both fallbacks for a record that carries an undeclared key', () => {
    writeWorkspace('review', { sort: 'name', openRecord: false, dead: 1 });
    expect(readSort()).toBe('confidence');
    expect(readOpenRecord()).toBe(true);
  });
});
