import { beforeEach, expect, test, vi } from 'vitest';

import {
  LAYOUT_MAX_AGE_MS,
  LAYOUT_MIN_GAP_MS,
  LAYOUT_NEW_ENTITIES,
  layoutRefresher,
} from './layout-refresh.ts';

const WRITE = 'set_entity_layout';

interface Basis {
  entities: number;
  relations: number;
  newest: string | null;
}

// A fake connection. The basis is what the record holds now. A statement that the fake does not
// know answers with no row.
const setup = () => {
  const state: { basis: Basis } = { basis: { entities: 5, relations: 3, newest: '2026-01-01' } };
  const calls: string[] = [];
  let clock = 0;
  let fail = false;
  const db = {
    query: (text: string): Promise<{ rows: unknown[] }> => {
      calls.push(text);
      if (text.includes('count(*)')) return Promise.resolve({ rows: [{ ...state.basis }] });
      if (text.includes(WRITE)) {
        if (fail) return Promise.reject(new Error('the write failed'));
        return Promise.resolve({ rows: [] });
      }
      if (text.startsWith('SELECT id FROM public.entities'))
        return Promise.resolve({
          rows: Array.from({ length: state.basis.entities }, (_, index) => ({
            id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
          })),
        });
      return Promise.resolve({ rows: [] });
    },
  };
  const refresh = layoutRefresher({ db, now: () => clock });
  return {
    state,
    refresh,
    runs: () => calls.filter((text) => text.includes(WRITE)).length,
    advance: (ms: number) => {
      clock += ms;
    },
    failWrites: () => {
      fail = true;
    },
  };
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

test('the first idle step runs the layout, because the worker knows no stored layout', async () => {
  const one = setup();
  await one.refresh();
  expect(one.runs()).toBe(1);
});

test('an unchanged record runs nothing again', async () => {
  const one = setup();
  await one.refresh();
  one.advance(LAYOUT_MIN_GAP_MS);
  await one.refresh();
  expect(one.runs()).toBe(1);
});

test('a few new entities with no relation run nothing', async () => {
  const one = setup();
  await one.refresh();
  one.state.basis.entities += LAYOUT_NEW_ENTITIES - 1;
  one.advance(LAYOUT_MIN_GAP_MS);
  await one.refresh();
  expect(one.runs()).toBe(1);
});

test('many new entities run the layout', async () => {
  const one = setup();
  await one.refresh();
  one.state.basis.entities += LAYOUT_NEW_ENTITIES;
  one.advance(LAYOUT_MIN_GAP_MS);
  await one.refresh();
  expect(one.runs()).toBe(2);
});

test('a new relation runs the layout', async () => {
  const one = setup();
  await one.refresh();
  one.state.basis.entities += 1;
  one.state.basis.relations += 1;
  one.state.basis.newest = '2026-02-01';
  one.advance(LAYOUT_MIN_GAP_MS);
  await one.refresh();
  expect(one.runs()).toBe(2);
});

test('a layout older than the set age runs again', async () => {
  const one = setup();
  await one.refresh();
  one.advance(LAYOUT_MAX_AGE_MS);
  await one.refresh();
  expect(one.runs()).toBe(2);
});

test('a burst of changes runs the layout once inside the minimum gap', async () => {
  const one = setup();
  await one.refresh();
  one.state.basis.relations += 1;
  one.advance(LAYOUT_MIN_GAP_MS - 1);
  await one.refresh();
  expect(one.runs()).toBe(1);
  one.advance(1);
  await one.refresh();
  expect(one.runs()).toBe(2);
});

test('a run that throws is logged and does not throw, and a later step tries again', async () => {
  const one = setup();
  one.failWrites();
  await expect(one.refresh()).resolves.toBeUndefined();
  expect(console.error).toHaveBeenCalled();
  one.advance(LAYOUT_MIN_GAP_MS);
  await one.refresh();
  expect(one.runs()).toBe(2);
});

test('idle steps that run together share one run of the layout', async () => {
  const { refresh, runs } = setup();
  await Promise.all([refresh(), refresh(), refresh()]);
  expect(runs()).toBe(1);
});
