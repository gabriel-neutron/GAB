import { expect, it } from 'vitest';

import { laneSummary } from './lane-words';

it('says how many units the rules decided and how many wait in each list', () => {
  expect(laneSummary({ decided: 12, doubt: 3, waiting: 40 })).toBe(
    'The rules decided 12 units. 3 doubts wait for you. 40 units wait for a source.',
  );
});

it('uses the singular for one, and a plain zero', () => {
  expect(laneSummary({ decided: 1, doubt: 1, waiting: 1 })).toBe(
    'The rules decided 1 unit. 1 doubt waits for you. 1 unit waits for a source.',
  );
  expect(laneSummary({ decided: 0, doubt: 0, waiting: 0 })).toBe(
    'The rules decided 0 units. 0 doubts wait for you. 0 units wait for a source.',
  );
});

it('never presents a decision of a rule as a decision of the operator, and names no import', () => {
  const said = laneSummary({ decided: 5, doubt: 2, waiting: 9 });
  expect(said).not.toMatch(/operator|v1|import/iu);
});
