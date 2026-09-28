import { expect, test } from 'vitest';

import type { ClaimValue } from './claims';
import type { RecordRow } from './dossier';
import { draftsAfterSave, pendingEdit, type ClaimDraft, type Drafts } from './draft';

const typed = (text: string): ClaimDraft => ({ value: { control: 'text', text }, refusal: null });

const row = (key: string, value: ClaimValue): RecordRow => ({
  claim: { key, label: key, value, width: 'short', sources: [] },
  sources: [],
});

const TONNAGE = row('tonnage', { control: 'number', text: '41.5' });
const OWNER = row('owner', { control: 'text', text: 'Acme' });

const typedNumber = (text: string, refusal: string | null = null): ClaimDraft => ({
  value: { control: 'number', text },
  refusal,
});

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

test('a number written in another form is no change', () => {
  const drafts: Drafts = new Map([['tonnage', typedNumber('41.50')]]);
  expect(pendingEdit([TONNAGE], drafts)).toStrictEqual({
    ready: false,
    reason: 'Nothing is changed.',
  });
});

test('one refused draft beside one valid draft composes no act', () => {
  const drafts: Drafts = new Map([
    ['tonnage', typedNumber('41,5', 'Write the number with a decimal point.')],
    ['owner', typed('Acme Shipping')],
  ]);
  expect(pendingEdit([TONNAGE, OWNER], drafts)).toStrictEqual({
    ready: false,
    reason: 'One value is refused. Correct it, and then save.',
  });
});

test('a draft typed back to the stored text is skipped', () => {
  const drafts: Drafts = new Map([
    ['owner', typed('Acme')],
    ['tonnage', typedNumber('42')],
  ]);
  expect(pendingEdit([TONNAGE, OWNER], drafts)).toStrictEqual({
    ready: true,
    attrs: { tonnage: { v: 42 } },
    count: 1,
  });
});
