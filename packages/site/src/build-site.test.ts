import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { expect, test } from 'vitest';

import { buildSite } from './build-site.tsx';
import { SiteReleaseFault } from './site-release-fault.ts';

const FIXTURE = resolve(import.meta.dirname, '../fixtures/release');
const VESSEL = '0a1f0000-0000-4000-8000-000000000001';
const NEWS = 'https://news.example.org/tanker';

const fixture = (): Map<string, string> =>
  new Map(readdirSync(FIXTURE).map((name) => [name, readFileSync(join(FIXTURE, name), 'utf8')]));

/** The fixed release with one text replaced in each file that holds it. */
const changed = (from: string, to: string): Map<string, string> =>
  new Map([...fixture()].map(([path, text]) => [path, text.replaceAll(from, to)]));

const pagesOf = (files: ReadonlyMap<string, string>) =>
  buildSite(files, '', false).filter((one) => one.path.endsWith('.html'));

test.each([
  'javascript:alert(1)',
  'data:text/html;charset=utf-8',
  '//evil.example/x',
  '../manifest.json',
])('a source address %s is shown as text and never as a link', (address) => {
  const pages = pagesOf(changed(NEWS, address));
  const claim = pages.find((one) => one.path === `claim/${VESSEL}/flag/index.html`);
  expect(claim?.text).toContain(address);
  expect(claim?.text).not.toContain(`href="${address}"`);
  for (const page of pages) expect(page.text).not.toMatch(/href="(javascript|data:text|\/\/)/u);
});

test.each([
  'javascript:alert(1)',
  'data:text/html;charset=utf-8',
  '//evil.example/x',
  '../manifest.json',
])('a contact address %s refuses the release', (address) => {
  expect(() => pagesOf(changed('https://example.org/report-an-error', address))).toThrow(
    SiteReleaseFault,
  );
});

test.each(['..', 'a:b', 'index.html', 'a b'])(
  'a claim key "%s" that cannot be a path refuses the release',
  (key) => {
    expect(() => pagesOf(changed(`${VESSEL}/imo`, `${VESSEL}/${key}`))).toThrow(SiteReleaseFault);
  },
);

test('two claim keys that differ only by case refuse the release', () => {
  expect(() => pagesOf(changed(`${VESSEL}/flag`, `${VESSEL}/IMO`))).toThrow(/case/u);
});

test('a label with the end of a script element stays text in the map page', () => {
  const hostile = 'Primorsk</script><script>alert(1)</script>';
  const map = pagesOf(changed('Primorsk', hostile)).find((one) => one.path === 'map/index.html');
  expect(map?.text).not.toContain('</script><script>alert(1)');
  expect(map?.text).toContain('Primorsk\\u003c/script>');
});

test('the permanent address of a claim is the identifier of the JSON-LD file', () => {
  const pages = pagesOf(changed(`${VESSEL}/imo`, `${VESSEL}/call_sign`));
  const claim = pages.find((one) => one.path === `claim/${VESSEL}/call_sign/index.html`);
  expect(claim?.text).toContain(`https://gab.example.org/claim/${VESSEL}/call_sign`);
});

test('each page has an icon that the page holds, so the browser asks the host for none', () => {
  for (const page of pagesOf(fixture()))
    expect(page.text).toMatch(/<link rel="icon" href="data:image\/svg\+xml,/u);
});

test('the stylesheet of MapLibre is in the head of the map page', () => {
  const map = pagesOf(fixture()).find((one) => one.path === 'map/index.html');
  const head = map?.text.split('</head>')[0] ?? '';
  expect(head).toContain('href="../assets/maplibre-gl.css"');
});
