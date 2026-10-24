import { expect, test } from 'vitest';

import { CHAIN, FIXTURE_RELEASE } from './fixture-release';
import { globeData } from './globe-data';
import { frameOf, highlightOf, pickHit } from './globe-view';

const data = globeData(FIXTURE_RELEASE.chain);

test('an entity puts its chain forward, before a step and a product', () => {
  const asked = highlightOf(data, {
    stage: null,
    entity: CHAIN.PIPELINE,
    step: 'export',
    product: 'gas',
  });
  expect(asked?.assets.has(CHAIN.FIELD)).toBe(true);
  expect(asked?.assets.has(CHAIN.REFINERY)).toBe(true);
});

test('a step puts its assets and its links forward, before a product', () => {
  const asked = highlightOf(data, {
    stage: null,
    entity: null,
    step: 'extraction',
    product: 'gas',
  });
  expect([...(asked?.assets ?? [])]).toContain(CHAIN.FIELD);
  expect(asked?.arcs.size).toBe(0);
});

test('a product puts its links forward, and nothing asked puts nothing forward', () => {
  const crude = highlightOf(data, { stage: null, entity: null, step: null, product: 'crude' });
  expect(crude?.arcs.has(CHAIN.FIELD_TO_PIPELINE)).toBe(true);
  expect(highlightOf(data, { stage: null, entity: null, step: null, product: 'all' })).toBeNull();
  expect(
    highlightOf(data, { stage: null, entity: null, step: 'unknown', product: 'all' }),
  ).toBeNull();
});

test('the frame holds the given places and nothing else', () => {
  const places = new Map([
    ['a', [[10, 20]] as const],
    [
      'b',
      [
        [30, 5],
        [20, 40],
      ] as const,
    ],
  ]);
  expect(frameOf(places, ['a', 'b'])).toStrictEqual([
    [10, 5],
    [30, 40],
  ]);
  expect(frameOf(places, ['missing'])).toBeNull();
  expect(frameOf(places, [])).toBeNull();
});

const GROUPS = [['points'], ['exits'], ['lines', 'areas'], ['arcs-a', 'arcs-b']] as const;

test('a point wins over a line under the same click', () => {
  const picked = pickHit(
    [
      { layer: 'arcs-a', id: 'link' },
      { layer: 'points', id: 'one' },
    ],
    GROUPS,
  );
  expect(picked).toStrictEqual({ kind: 'one', hit: { layer: 'points', id: 'one' } });
});

test('two points under one click give a choice, and one feature in two layers counts once', () => {
  const picked = pickHit(
    [
      { layer: 'points', id: 'one' },
      { layer: 'points', id: 'two' },
      { layer: 'points', id: 'one' },
    ],
    GROUPS,
  );
  expect(picked.kind === 'many' ? picked.hits.map((one) => one.id) : []).toStrictEqual([
    'one',
    'two',
  ]);
  const halo = pickHit(
    [
      { layer: 'arcs-a', id: 'link' },
      { layer: 'arcs-b', id: 'link' },
    ],
    GROUPS,
  );
  expect(halo.kind).toBe('one');
});

test('two links under one click open the first, and an empty click picks nothing', () => {
  const picked = pickHit(
    [
      { layer: 'arcs-a', id: 'first' },
      { layer: 'arcs-a', id: 'second' },
    ],
    GROUPS,
  );
  expect(picked).toStrictEqual({ kind: 'one', hit: { layer: 'arcs-a', id: 'first' } });
  expect(pickHit([], GROUPS)).toStrictEqual({ kind: 'none' });
});

test('a stage of the legend puts its points forward, and every link dims', () => {
  const asked = highlightOf(data, { stage: 'field', entity: null, step: 'export', product: 'gas' });
  expect(asked?.assets.has(CHAIN.FIELD)).toBe(true);
  expect(asked?.assets.has(CHAIN.PIPELINE)).toBe(false);
  expect(asked?.arcs.size).toBe(0);
});

test('an asset wins over a stage', () => {
  const asked = highlightOf(data, {
    stage: 'field',
    entity: CHAIN.PIPELINE,
    step: null,
    product: 'all',
  });
  expect(asked?.assets.has(CHAIN.PIPELINE)).toBe(true);
});

test('the exit stage puts every exit ring forward', () => {
  const asked = highlightOf(data, { stage: 'exit', entity: null, step: null, product: 'all' });
  expect([...(asked?.exits ?? [])].sort()).toEqual(Object.keys(data.exitInfo).sort());
});

test('the stage "none" puts forward the points that have no stage, and only them', () => {
  const asked = highlightOf(data, { stage: 'none', entity: null, step: null, product: 'all' });
  const none = [...data.stages].filter(([, key]) => key === null).map(([id]) => id);
  expect([...(asked?.assets ?? [])].sort()).toEqual(none.sort());
  expect(asked?.assets.has(CHAIN.FIELD)).toBe(false);
});
