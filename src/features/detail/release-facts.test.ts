import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { QUIET_SITE, SITE, withEvents } from '@gab/release/event-fixture';
import { claimText } from '@gab/release/claim-text';
import { permanentAddress } from '@gab/release/site-paths';
import { pairRating, readSiteRelease } from '@gab/release/site-release';
import { expect, test } from 'vitest';

import { releaseFactsOf } from './release-facts';

const FOLDER = join(import.meta.dirname, '../../../packages/site/fixtures/release');
const VESSEL = '0a1f0000-0000-4000-8000-000000000001';
const ABSORBED = '0a1f0000-0000-4000-8000-000000000005';
const COMPANY = '0a1f0000-0000-4000-8000-000000000002';

const files = new Map(
  readdirSync(FOLDER).map((one) => [one, readFileSync(join(FOLDER, one), 'utf8')]),
);
const release = readSiteRelease(withEvents(files));

test('a public vessel gives its IMO number and the identifiers that a merge absorbed', () => {
  const facts = releaseFactsOf(release, VESSEL, 'vessel', true);
  expect(facts.imo).toBe('9000001');
  expect(facts.merged).toEqual([ABSORBED]);
});

test('an entity that is no vessel has no IMO number and no merged identifier', () => {
  const facts = releaseFactsOf(release, COMPANY, 'company', true);
  expect(facts.imo).toBeNull();
  expect(facts.merged).toEqual([]);
  expect(facts.events).toBeNull();
});

test('a site gives its events, and a site with none still gives the counter part', () => {
  const lines = releaseFactsOf(release, SITE, 'facility', true).events;
  expect(lines?.length).toBeGreaterThan(0);
  expect(releaseFactsOf(release, QUIET_SITE, 'facility', true).events).toEqual([]);
});

test('a page that reads the live record asks for no events', () => {
  expect(releaseFactsOf(release, SITE, 'facility', false).events).toBeNull();
});

test('an actor has a page of its own only when the release holds it', () => {
  const lines = releaseFactsOf(release, SITE, 'facility', true).events ?? [];
  const named = lines.filter((line) => line.event.actor !== null);
  expect(named.length).toBeGreaterThan(0);
  for (const line of named)
    expect(line.actorKnown).toBe(release.entityById.has(line.event.actor?.id ?? ''));
});

test('the claims of the release give their words, their label and their licence', () => {
  const facts = releaseFactsOf(release, VESSEL, 'vessel', true);
  const expected = release.claimsAbout.get(VESSEL) ?? [];
  expect(expected.length).toBeGreaterThan(0);
  expect(facts.claims.map((claim) => claim.id)).toEqual(expected.map((claim) => claim.id));
  expected.forEach((claim, place) => {
    expect(facts.claims[place]).toEqual({
      id: claim.id,
      text: claimText(claim),
      origin: claim.originLabel,
      licence: claim.licence,
      rating: pairRating(release.manifest, claim),
    });
  });
  expect(facts.address).toBe(permanentAddress(release.manifest.iriBase, 'entity', VESSEL));
});

test('a page that reads the live record gets no claim line and no address from the release', () => {
  const facts = releaseFactsOf(release, VESSEL, 'vessel', false);
  expect(facts.claims).toEqual([]);
  expect(facts.address).toBeNull();
});

test('the release words how it found the place of an entity, and says nothing for an entity with no place', () => {
  const located = release.entities.find((one) => one.geolocationMethod !== null);
  expect(located).toBeDefined();
  const facts = releaseFactsOf(release, located?.id ?? '', located?.type ?? '', true);
  expect(facts.location).not.toBeNull();
  expect(
    releaseFactsOf(release, '0a1f0000-0000-4000-8000-000000000001', 'vessel', true).location,
  ).toBe('coordinates that the source writes');
  const unlocated = release.entities.find((one) => one.geolocationMethod === null);
  expect(
    releaseFactsOf(release, unlocated?.id ?? '', unlocated?.type ?? '', true).location,
  ).toBeNull();
  expect(
    releaseFactsOf(release, located?.id ?? '', located?.type ?? '', false).location,
  ).toBeNull();
});
