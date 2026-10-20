import { expect, test } from 'vitest';

import { releaseNotes } from './release-notes.ts';

const HEADING = {
  version: '1.0',
  date: '2026-10-21',
  title: 'GAB release 1.0, 2026-10-21',
  disclaimer: 'The disclaimer.',
};

test('the notes of a release that shows the pair give the share, in all and by type', () => {
  const { path, text } = releaseNotes(HEADING, {
    all: { claims: 8, paired: 3 },
    byType: [{ group: 'entity vessel', claims: 4, paired: 3 }],
  });
  expect(path).toBe('release-notes.md');
  expect(text).toContain('3 of 8 public claims (37.5%) have a full pair');
  expect(text).toContain('"not rated"');
  expect(text).toContain('| entity vessel | 3 | 4 | 75.0% |');
});

test('the notes of a release that hides the pair name no share', () => {
  const { text } = releaseNotes(HEADING, null);
  expect(text).toContain('The disclaimer.');
  expect(text).not.toMatch(/pair|%/u);
});

test('a release with no claim has a share of zero', () => {
  expect(releaseNotes(HEADING, { all: { claims: 0, paired: 0 }, byType: [] }).text).toContain(
    '0 of 0 public claims (0.0%)',
  );
});
