import { expect, it } from 'vitest';

import { barStateOf } from './bar-state';

const ONE = 'a3f1c8de-5b20-4a71-9c34-7e0d81f65b12';
const TWO = 'b7e2d9f0-6c31-4b82-8d45-8f1e92a76c23';

it('locks the bar of each unit while one decision is on the way', () => {
  expect(barStateOf({ step: 'working', unitId: ONE }, TWO).step).toBe('working');
  expect(barStateOf({ step: 'working', unitId: ONE }, ONE).step).toBe('working');
});

it('shows the result of a decision on its own unit only', () => {
  const refused = { step: 'refused', unitId: ONE, refusal: 'no' } as const;

  expect(barStateOf(refused, ONE)).toBe(refused);
  expect(barStateOf(refused, TWO).step).toBe('idle');
  expect(barStateOf({ step: 'idle' }, ONE).step).toBe('idle');
});
