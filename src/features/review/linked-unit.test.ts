import { expect, it, vi } from 'vitest';

import { linkedUnit } from './linked-unit';
import { unitPageOf } from './unit-page';
import { SAMPLE_UNITS, UNIT_ANSWER } from './unit-sample';
import type { UnitRead } from './units';

const page = unitPageOf(UNIT_ANSWER, null);
if (page === null) throw new Error('the sample is no page');
const FIRST = { state: 'held' as const, page };
const FAR = 'c0ffee00-0000-4000-8000-000000000000';
const [ARMY] = page.units;
if (ARMY === undefined) throw new Error('the sample holds no unit');

const reader = (answer: UnitRead) => vi.fn(() => Promise.resolve(answer));

it('reads no unit when the address names none, or when the first page holds it', async () => {
  const read = reader({ state: 'gone' });
  expect(await linkedUnit('', FIRST, read)).toStrictEqual({ state: 'none' });
  expect(await linkedUnit(SAMPLE_UNITS.army, FIRST, read)).toStrictEqual({ state: 'none' });
  expect(await linkedUnit(FAR, { state: 'private', why: 'private' }, read)).toStrictEqual({
    state: 'none',
  });
  expect(read).not.toHaveBeenCalled();
});

it('reads a unit that is not on the first page by its identifier', async () => {
  const read = reader({ state: 'held', unit: ARMY });
  expect(await linkedUnit(FAR, FIRST, read)).toStrictEqual({ state: 'held', unit: ARMY });
  expect(read).toHaveBeenCalledWith(FAR);
});

it('says that a unit waits no more, and keeps a failed read apart with its sentence', async () => {
  expect(await linkedUnit(FAR, FIRST, reader({ state: 'gone' }))).toStrictEqual({
    state: 'gone',
    unitId: FAR,
  });
  expect(
    await linkedUnit(FAR, FIRST, reader({ state: 'failed', why: 'The writer did not answer.' })),
  ).toStrictEqual({ state: 'failed', unitId: FAR, why: 'The writer did not answer.' });
});
