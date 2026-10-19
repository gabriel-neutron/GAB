import { expect, test } from 'vitest';

import { isAccepted } from './accepted.ts';

test.each([
  ['Proposed — not checked', false],
  ['Accepted by rule strong_sources v2 — no person read it, on 2026-10-02', true],
  ['Accepted by an AI reviewer — no person read it, on 2026-10-02', true],
  ['Validated manually by the operator, on 2026-10-04', true],
])('the label "%s" gives accepted %s', (label, accepted) => {
  expect(isAccepted(label)).toBe(accepted);
});
