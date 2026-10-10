import { readdirSync, readFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';

import { expect, test } from 'vitest';

import { buildSite } from './build-site.tsx';

const FIXTURES = resolve(import.meta.dirname, '../fixtures');
const VESSEL = '0a1f0000-0000-4000-8000-000000000001';
const TWIN = '0a1f0000-0000-4000-8000-000000000009';
const ABSORBED = '0a1f0000-0000-4000-8000-000000000005';
const OWNS = '0a1f0000-0000-4000-8000-000000000011';
const OLD_OWNS = '0a1f0000-0000-4000-8000-000000000014';
const OPERATES = '0a1f0000-0000-4000-8000-000000000015';
const INSURES = '0a1f0000-0000-4000-8000-000000000016';
const LOADS = '0a1f0000-0000-4000-8000-000000000013';
const PAGE = 'vessel/9000001/index.html';

const fixture = (name: string): Map<string, string> => {
  const folder = join(FIXTURES, name);
  return new Map(readdirSync(folder).map((one) => [one, readFileSync(join(folder, one), 'utf8')]));
};

const changed = (from: string, to: string): Map<string, string> =>
  new Map([...fixture('release')].map(([path, text]) => [path, text.replaceAll(from, to)]));

const pagesOf = (files: ReadonlyMap<string, string>) =>
  new Map(
    buildSite(files, '', false)
      .filter((one) => one.path.endsWith('.html'))
      .map((one) => [one.path, one.text]),
  );

const off = pagesOf(fixture('release'));
const on = pagesOf(fixture('release-nato'));

const read = (pages: ReadonlyMap<string, string>, path: string): string => {
  const text = pages.get(path);
  if (text === undefined) throw new Error(`the site has no page ${path}`);
  return text;
};

/** The text of the item of the list of marks that holds the claim link, from the start of the
 * item to its end. */
const itemOf = (text: string, claimId: string): string => {
  const at = text.indexOf(`claim/${claimId}/index.html" aria-label=`);
  const start = text.lastIndexOf('<li', at);
  return text.slice(start, text.indexOf('</li>', at));
};

test('each public vessel with an IMO number has one page, at the address of its number', () => {
  const vesselPages = [...off.keys()].filter((one) => one.startsWith('vessel/'));
  expect(vesselPages).toStrictEqual([PAGE]);
});

test('two vessels with the same IMO number and no merge share one page that names both', () => {
  const text = read(off, PAGE);
  expect(text).toContain('Severnaya Volna');
  expect(text).toContain('Northern Wave');
  expect(text).toContain('2 vessels of the release carry this IMO number');
});

test('a vessel with no IMO number of seven digits has no page', () => {
  const pages = pagesOf(changed(',imo,9000001,', ',imo,900001,'));
  expect([...pages.keys()].filter((one) => one.startsWith('vessel/'))).toStrictEqual([]);
});

test('an IMO number with its prefix gives the page of the number', () => {
  const pages = pagesOf(changed(',imo,9000001,', ',imo,IMO 9000001,'));
  expect(pages.has(PAGE)).toBe(true);
});

test('each mark of the timeline links to a claim page of the site', () => {
  for (const pages of [off, on]) {
    const text = read(pages, PAGE);
    const targets = [...text.matchAll(/href="([^"]*claim\/[^"]*)"/gu)].map(([, address = '']) =>
      posix.normalize(posix.join(posix.dirname(PAGE), decodeURIComponent(address))),
    );
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) expect(pages.has(target)).toBe(true);
    for (const claim of [
      OWNS,
      OLD_OWNS,
      `${OLD_OWNS}/valid_to`,
      OPERATES,
      INSURES,
      `${LOADS}/loaded_on`,
      `${VESSEL}/former_names`,
      `${VESSEL}/flag`,
      '0a1f0000-0000-4000-8000-000000000012',
    ])
      expect(targets).toContain(`claim/${claim}/index.html`);
  }
});

test('an open bound shows as open to the day of the version, and never as ended', () => {
  const item = itemOf(read(off, PAGE), OWNS);
  expect(item).toContain('Arctic Bridge Shipping');
  expect(item).toContain('01/03/2024');
  expect(item).toContain('open');
  expect(item).not.toContain('08/11/2026');
});

test('a closed bound gives its end date and the claim of the act that ended it', () => {
  const item = itemOf(read(off, PAGE), OLD_OWNS);
  expect(item).toContain('01/06/2019');
  expect(item).toContain('01/03/2024');
  expect(item).toContain(`claim/${OLD_OWNS}/valid_to/index.html`);
});

test('a bound with no start shows as unknown', () => {
  expect(itemOf(read(off, PAGE), OPERATES)).toMatch(/start unknown/iu);
});

test('a port call gives the day of its value claim, and a former name has no date', () => {
  const text = read(off, PAGE);
  expect(itemOf(text, `${LOADS}/loaded_on`)).toContain('14/08/2025');
  expect(itemOf(text, `${VESSEL}/former_names`)).toContain('Volna Star');
  expect(itemOf(text, `${VESSEL}/former_names`)).toContain('no date');
});

test('the timeline is drawn as a figure at build time, with no script', () => {
  const text = read(off, PAGE);
  expect(text).toContain('<svg');
  expect(text).not.toContain('<script');
});

test('the entity page of each vessel and the home page link to the vessel page', () => {
  expect(read(off, `entity/${VESSEL}/index.html`)).toContain(
    'href="../../vessel/9000001/index.html"',
  );
  expect(read(off, `entity/${TWIN}/index.html`)).toContain(
    'href="../../vessel/9000001/index.html"',
  );
  expect(read(off, 'index.html')).toContain('href="vessel/9000001/index.html"');
});

test('a merged vessel has one page, and the page names the absorbed identifier', () => {
  const text = read(off, PAGE);
  expect(text).toContain(ABSORBED);
  expect(read(off, `entity/${ABSORBED}/index.html`)).toContain(`entity/${VESSEL}/index.html`);
});

test('the vessel page shows the NATO pair only when the release shows it', () => {
  expect(read(off, PAGE)).not.toMatch(/NATO|data-nato-pair/u);
  expect(read(on, PAGE)).toContain('data-nato-pair');
});
