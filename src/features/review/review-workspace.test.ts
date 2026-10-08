import { afterEach, expect, it, vi } from 'vitest';

import { filterIsOn, NO_FILTER, patchQueueFilter, readReviewWorkspace } from './review-workspace';

// The offline project has no browser, so the store of the workspace is a map here.
const storage = (): void => {
  const held = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => held.get(key) ?? null,
      setItem: (key: string, value: string) => {
        held.set(key, value);
      },
    },
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

it('merges a late name into the newest filter, and keeps a choice made after the typing', () => {
  storage();
  patchQueueFilter({ fault: 'dispute' });
  // The proposer was chosen while the pause of the typing ran; then the name arrives alone.
  patchQueueFilter({ proposer: 'extractor' });
  expect(patchQueueFilter({ name: 'arsenal' })).toStrictEqual({
    ...NO_FILTER,
    fault: 'dispute',
    proposer: 'extractor',
    name: 'arsenal',
  });
  expect(readReviewWorkspace().filter.proposer).toBe('extractor');
});

it('opens on the doubts, and keeps the list that the operator chose after a reload', () => {
  storage();
  expect(readReviewWorkspace().filter.lane).toBe('doubt');
  patchQueueFilter({ lane: 'waiting' });
  expect(readReviewWorkspace().filter.lane).toBe('waiting');
});

it('does not count the list as a filter, so no clear button shows for it', () => {
  expect(filterIsOn({ ...NO_FILTER, lane: 'waiting' })).toBe(false);
  expect(filterIsOn({ ...NO_FILTER, name: 'arsenal' })).toBe(true);
});

it('puts the place at the first unit after a change of the filter', () => {
  storage();
  patchQueueFilter({ name: 'brigade' });
  expect(readReviewWorkspace().from).toBeNull();
});
