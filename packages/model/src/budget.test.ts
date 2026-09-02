import { describe, expect, it } from 'vitest';

import { openBudget } from './budget.ts';

describe('the token cap of a job', () => {
  it('counts what each answer spends', () => {
    const budget = openBudget(100);
    budget.add(30);
    budget.add(20);
    expect(budget.spent()).toBe(50);
    expect(budget.left()).toBe(50);
  });

  it('never reports less than nothing left', () => {
    const budget = openBudget(10);
    budget.add(40);
    expect(budget.left()).toBe(0);
  });

  it('refuses a cap that is not a whole number above zero', () => {
    expect(() => openBudget(0)).toThrow();
    expect(() => openBudget(-1)).toThrow();
    expect(() => openBudget(1.5)).toThrow();
  });
});
