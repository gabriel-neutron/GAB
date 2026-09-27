import { expect, test } from 'vitest';

import { draftsAfterSave, type ClaimDraft, type Drafts } from './draft';

const typed = (text: string): ClaimDraft => ({ value: { control: 'text', text }, refusal: null });

const SENT: Drafts = new Map([['hull_note', typed('Repainted funnel and starboard')]]);
const ACT = { hull_note: { v: 'Repainted funnel and starboard' } };

test('a key the act carried goes back to its stored value', () => {
  expect(draftsAfterSave(SENT, SENT, ACT).has('hull_note')).toBe(false);
});

test('a key retyped while the act was in flight keeps the new text', () => {
  const retyped = typed('Repainted funnel and starboard side');
  const current: Drafts = new Map([['hull_note', retyped]]);
  expect(draftsAfterSave(current, SENT, ACT).get('hull_note')).toStrictEqual(retyped);
});

test('a key the act did not carry keeps its draft', () => {
  const flags = typed('PA, MN,GB');
  const current: Drafts = new Map([...SENT, ['known_flags', flags]]);
  expect(draftsAfterSave(current, SENT, ACT).get('known_flags')).toStrictEqual(flags);
});
