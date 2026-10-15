import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { expect, test } from 'vitest';

import { buildSite } from './build-site.tsx';
import { FIRE, QUIET_SITE, SITE, STRIKE, withEvents } from './event-fixture.ts';

const FOLDER = join(resolve(import.meta.dirname, '../fixtures'), 'release');
const base = new Map(
  readdirSync(FOLDER).map((one) => [one, readFileSync(join(FOLDER, one), 'utf8')]),
);

const pages = new Map(
  buildSite(withEvents(base), '', false)
    .filter((one) => one.path.endsWith('.html'))
    .map((one) => [one.path, one.text]),
);

const page = (id: string): string => {
  const text = pages.get(`entity/${id}/index.html`);
  if (text === undefined) throw new Error(`the site has no page for ${id}`);
  return text;
};

/** The text of the item of the lane that holds the claim link. */
const itemOf = (text: string, claimId: string): string => {
  const at = text.indexOf(`claim/${claimId}/index.html"`);
  const start = text.lastIndexOf('<li', at);
  return text.slice(start, text.indexOf('</li>', at));
};

test('the page of a site gives a lane of its events, each with kind, day, actor and document', () => {
  const item = itemOf(page(SITE), `${STRIKE}/occurred_on`);
  expect(item).toContain('claimed attack');
  expect(item).toContain('у ніч на 15 травня');
  expect(item).toContain('2026-05-14');
  expect(item).toContain('Unmanned Systems Forces');
  expect(item).toContain('href="https://news.example.org/page"');
});

test('an event with no actor in the release says so', () => {
  expect(itemOf(page(SITE), `${FIRE}/occurred_on`)).toContain('No actor stored.');
});

test('the counter reads "at least N claimed and stored strikes" and gives the limit of the survey', () => {
  const text = page(SITE);
  expect(text).toContain('At least 2 claimed and stored strikes.');
  expect(text).toContain('not a count of all strikes');
  expect(text).not.toMatch(/\btotal\b/iu);
});

test('a site with no stored event reads at least 0, and never zero strikes', () => {
  expect(page(QUIET_SITE)).toContain('At least 0 claimed and stored strikes.');
});

test('the stored counter-statement shows, and its absence is said', () => {
  const text = page(SITE);
  expect(itemOf(text, `${STRIKE}/occurred_on`)).toContain('No strike took place at the terminal');
  expect(itemOf(text, `${STRIKE}/occurred_on`)).not.toContain('no counter-statement stored');
  expect(itemOf(text, `${FIRE}/occurred_on`)).toContain('no counter-statement stored');
});

test('the page never says destroyed, confirmed or successful', () => {
  expect(page(SITE)).not.toMatch(/destroyed|confirmed|successful/iu);
});

test('the page of an event shows no lane', () => {
  expect(page(STRIKE)).not.toContain('claimed and stored strike');
});
