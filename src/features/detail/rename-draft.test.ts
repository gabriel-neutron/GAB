import { expect, test } from 'vitest';

import { readRenameDraft, renameWords } from './rename-draft';

const ENTITY = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';
const STORED = { label: 'MV Northern Ledger', type: 'unknown' };

test('an untouched form sends nothing, and says what to change', () => {
  const draft = readRenameDraft(ENTITY, STORED, STORED);
  expect(draft).toStrictEqual({
    ready: false,
    reason: 'Change the name or the type, and then save.',
  });
});

test('a name that differs only by the spaces around it is no change', () => {
  const draft = readRenameDraft(ENTITY, STORED, { ...STORED, label: '  MV Northern Ledger ' });
  expect(draft).toStrictEqual({
    ready: false,
    reason: 'Change the name or the type, and then save.',
  });
});

test('a blank name is refused before a round trip', () => {
  const draft = readRenameDraft(ENTITY, STORED, { ...STORED, label: '   ' });
  expect(renameWords(draft)).toBe('Write a name for the entity.');
});

test('a new name alone sends the name, and leaves the type as it stands', () => {
  const draft = readRenameDraft(ENTITY, STORED, { ...STORED, label: 'MV Southern Ledger' });
  expect(draft).toStrictEqual({
    ready: true,
    act: { op: 'update_entity', targetId: ENTITY, label: 'MV Southern Ledger', type: null },
  });
  expect(renameWords(draft)).toBe('Ready to save a new name.');
});

test('a new type alone sends the type, and leaves the name as it stands', () => {
  const draft = readRenameDraft(ENTITY, STORED, { ...STORED, type: 'vessel' });
  expect(draft).toStrictEqual({
    ready: true,
    act: { op: 'update_entity', targetId: ENTITY, label: null, type: 'vessel' },
  });
  expect(renameWords(draft)).toBe('Ready to save a new type.');
});

test('a new name and a new type go in one act, and the name is trimmed', () => {
  const draft = readRenameDraft(ENTITY, STORED, { label: ' MV Southern Ledger ', type: 'vessel' });
  expect(draft).toStrictEqual({
    ready: true,
    act: { op: 'update_entity', targetId: ENTITY, label: 'MV Southern Ledger', type: 'vessel' },
  });
  expect(renameWords(draft)).toBe('Ready to save a new name and a new type.');
});
