import { expect, test } from 'vitest';

import { releaseNotes } from './release-notes.ts';

const HEADING = {
  version: '1.0',
  date: '2026-10-21',
  title: 'GAB release 1.0, 2026-10-21',
  disclaimer: 'The disclaimer.',
};

const PLACES = {
  places: 4,
  notStated: 1,
  byMethod: [
    { method: 'source_coordinates', count: 2 },
    { method: 'not_stated', count: 1 },
    { method: 'satellite_match', count: 1 },
  ],
};

test('the notes of a release that shows the pair give the share, in all and by type', () => {
  const { path, text } = releaseNotes(
    HEADING,
    {
      all: { claims: 8, paired: 3 },
      byType: [{ group: 'entity vessel', claims: 4, paired: 3 }],
    },
    PLACES,
    7,
  );
  expect(path).toBe('release-notes.md');
  expect(text).toContain('3 of 8 public claims (37.5%) have a full pair');
  expect(text).toContain('"not rated"');
  expect(text).toContain('| entity vessel | 3 | 4 | 75.0% |');
});

test('the notes of a release that hides the pair name no share', () => {
  const { text } = releaseNotes(HEADING, null, PLACES, 7);
  expect(text).toContain('The disclaimer.');
  expect(text).not.toMatch(/pair/u);
});

test('the notes give the share of the places with no stated method, and the count of each method', () => {
  const { text } = releaseNotes(HEADING, null, PLACES, 7);
  expect(text).toContain('1 of 4 places (25.0%) have no stated method of geolocation');
  expect(text).toContain('| source_coordinates | 2 | 50.0% |');
  expect(text).toContain('| not_stated | 1 | 25.0% |');
});

test('a release with no place has a share of zero', () => {
  const { text } = releaseNotes(HEADING, null, { places: 0, notStated: 0, byMethod: [] }, 7);
  expect(text).toContain('0 of 0 places (0.0%)');
});

test('a release with no claim has a share of zero', () => {
  const notes = releaseNotes(HEADING, { all: { claims: 0, paired: 0 }, byType: [] }, PLACES, 7);
  expect(notes.text).toContain('0 of 0 public claims (0.0%)');
});

test('the notes give the count of distinct claims, and say that a row is one citation', () => {
  const { text } = releaseNotes(HEADING, null, PLACES, 13843);
  expect(text).toContain('13843 distinct claims');
  expect(text).toContain('A row of claims.csv is one citation');
});
