import { expect, test } from 'vitest';

import { changedAfterDesignation, imoOf } from './gur-owner-change.ts';

const page = (prose: string, owner: string): string => `IMO 9410894
Justification
${prose}
Ship Owner (IMO / Country / Date)
${owner}
Commercial ship manager (IMO / Country / Date)
Far Frontiers LLC (0391849 / russian federation / 01.01.2020)`;

test('a change after the earliest designation counts', () => {
  const text = page(
    'On November 25, 2024, the United Kingdom imposed sanctions on the vessel.\nSince December 13, 2025, Ukraine has imposed sanctions on the vessel.',
    'Far Frontiers LLC (0391849 / russian federation / 14.03.2025)',
  );
  expect(imoOf(text)).toBe('9410894');
  expect(changedAfterDesignation(text)).toBe(true);
});

test('a change on the day of the designation, or in its month, does not count', () => {
  const prose = 'On March 14, 2025, Canada imposed sanctions on the vessel.';
  expect(changedAfterDesignation(page(prose, 'X (1 / Y / 14.03.2025)'))).toBe(false);
  expect(changedAfterDesignation(page(prose, 'X (1 / Y / 03.2025)'))).toBe(false);
  expect(changedAfterDesignation(page(prose, 'X (1 / Y / 15.03.2025)'))).toBe(true);
});

test('a sanction on the master is not a designation of the ship, and a ship with no date is skipped', () => {
  expect(
    changedAfterDesignation(
      page('On May 1, 2026, Ukraine imposed sanctions on the master.', 'X (1 / Y / 02.2026)'),
    ),
  ).toBeUndefined();
});

test('only the sentence on sanctions gives the designation, also on one line', () => {
  const text = page(
    'Built in March 2009. The United Kingdom imposed sanctions on the vessel on May 1, 2025.',
    'X (1 / Y / 02.2025)',
  );
  expect(changedAfterDesignation(text)).toBe(false);
});
