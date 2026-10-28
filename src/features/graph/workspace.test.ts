import { afterEach, describe, expect, it, vi } from 'vitest';

import { readGraphWorkspace } from './workspace';

const store = (value: unknown): void => {
  const held = new Map([['gab.graph.v1', JSON.stringify(value)]]);
  vi.stubGlobal('window', {
    localStorage: { getItem: (key: string) => held.get(key) ?? null },
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the saved workspace of the graph', () => {
  it('keeps a record saved before the switch existed, hides the nodes with no relation, and drops the old hops', () => {
    store({
      camera: { x: 0.2, y: 0.3, ratio: 0.5 },
      hiddenTypes: ['vessel'],
      railOpen: false,
      railWidth: 300,
      hops: 2,
    });

    expect(readGraphWorkspace()).toEqual({
      camera: { x: 0.2, y: 0.3, ratio: 0.5 },
      hiddenTypes: ['vessel'],
      railOpen: false,
      railWidth: 300,
      showUnplaced: false,
      hiddenRelationTypes: [],
    });
  });

  it('keeps a saved choice to hide the ring', () => {
    store({
      camera: null,
      hiddenTypes: [],
      railOpen: true,
      railWidth: 256,
      showUnplaced: false,
    });

    expect(readGraphWorkspace().showUnplaced).toBe(false);
  });

  it('keeps a saved list of relation types that are switched off', () => {
    store({
      camera: null,
      hiddenTypes: [],
      railOpen: true,
      railWidth: 256,
      showUnplaced: true,
      hiddenRelationTypes: ['sts_with'],
    });

    expect(readGraphWorkspace().hiddenRelationTypes).toEqual(['sts_with']);
  });

  it('drops a record whose list of relation types holds a value that is not a word', () => {
    store({
      camera: null,
      hiddenTypes: [],
      railOpen: true,
      railWidth: 256,
      hiddenRelationTypes: [3],
    });

    expect(readGraphWorkspace().hiddenRelationTypes).toEqual([]);
  });
});
