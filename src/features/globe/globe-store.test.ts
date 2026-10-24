import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { createGlobeStore, STEP_TIME } from './globe-store';

const STEPS = ['extraction', 'pipeline', 'refinery'];
const make = (over: { still?: boolean; entity?: string | null } = {}) =>
  createGlobeStore({ steps: STEPS, still: over.still ?? false, entity: over.entity ?? null });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('the address entity is the selection at the start', () => {
  expect(make({ entity: 'e1' }).get().panel).toStrictEqual({
    kind: 'target',
    target: { kind: 'entity', id: 'e1' },
  });
  expect(make().get().panel).toStrictEqual({ kind: 'none' });
});

test('a reader who asks for no motion starts with the motion stopped', () => {
  expect(make({ still: true }).get().moving).toBe(false);
  expect(make().get().moving).toBe(true);
});

test('a selection ends the step, and a step ends the selection', () => {
  const store = make();
  store.setStep('pipeline');
  store.select({ kind: 'entity', id: 'e1' });
  expect(store.get().step).toBeNull();
  store.setStep('refinery');
  expect(store.get().panel).toStrictEqual({ kind: 'none' });
});

test('play goes through the steps by itself and stops at an act of the reader', () => {
  const store = make();
  store.togglePlay();
  expect(store.get()).toMatchObject({ playing: true, step: 'extraction' });
  vi.advanceTimersByTime(STEP_TIME);
  expect(store.get().step).toBe('pipeline');
  vi.advanceTimersByTime(STEP_TIME * 2);
  expect(store.get().step).toBe('extraction');
  store.stopPlay();
  vi.advanceTimersByTime(STEP_TIME * 3);
  expect(store.get()).toMatchObject({ playing: false, step: 'extraction' });
});

test('a choice of product, a selection and a pause each stop the play', () => {
  const store = make();
  store.togglePlay();
  store.setProduct('gas');
  expect(store.get().playing).toBe(false);
  store.togglePlay();
  store.select({ kind: 'arc', id: 'a1' });
  expect(store.get().playing).toBe(false);
  store.togglePlay();
  store.togglePlay();
  expect(store.get().playing).toBe(false);
  vi.advanceTimersByTime(STEP_TIME * 2);
  expect(store.get().step).toBe('extraction');
});

test('with no motion a press goes to the next step and nothing starts by itself', () => {
  const store = make({ still: true });
  store.togglePlay();
  store.togglePlay();
  expect(store.get()).toMatchObject({ playing: false, step: 'pipeline' });
  vi.advanceTimersByTime(STEP_TIME * 3);
  expect(store.get().step).toBe('pipeline');
});

test('stop motion stops the play and the motion, and a second stop changes nothing', () => {
  const store = make();
  const listener = vi.fn();
  store.togglePlay();
  store.subscribe(listener);
  store.stopMotion();
  expect(store.get()).toMatchObject({ playing: false, moving: false });
  const calls = listener.mock.calls.length;
  store.stopMotion();
  expect(listener.mock.calls.length).toBe(calls);
});

test('a choice holds the features under one click, and an unsubscribed listener hears nothing', () => {
  const store = make();
  const listener = vi.fn();
  const stop = store.subscribe(listener);
  store.choose([{ target: { kind: 'exit', id: 'x1' }, label: 'Exit' }]);
  expect(store.get().panel.kind).toBe('choice');
  stop();
  store.select(null);
  expect(listener).toHaveBeenCalledTimes(1);
});

test('a browser that cannot draw the globe says so', () => {
  const store = make();
  store.setUnavailable();
  expect(store.get().available).toBe(false);
});

test('a stage ends the step and the selection, and each of them ends the stage', () => {
  const store = make({ entity: 'e1' });
  store.setStep('pipeline');
  store.setStage('field');
  expect(store.get()).toMatchObject({ stage: 'field', step: null, panel: { kind: 'none' } });
  store.setStep('refinery');
  expect(store.get().stage).toBeNull();
  store.setStage('export');
  store.select({ kind: 'entity', id: 'e2' });
  expect(store.get().stage).toBeNull();
  store.setStage('export');
  store.next();
  expect(store.get().stage).toBeNull();
});

test('a product chip ends the stage, so the chain of the product comes forward', () => {
  const store = make();
  store.setStage('field');
  store.setProduct('crude');
  expect(store.get()).toMatchObject({ stage: null, product: 'crude' });
});
