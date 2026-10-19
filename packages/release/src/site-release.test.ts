import { expect, test } from 'vitest';

import { readSiteRelease } from './site-release.ts';
import { SiteReleaseFault } from './site-release-fault.ts';

const VESSEL = '0a1f0000-0000-4000-8000-000000000001';

const FIXTURE = import.meta.glob<string>('../../site/fixtures/release/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** The fixed release with one text replaced in each file that holds it. */
const changed = (from: string, to: string) =>
  readSiteRelease(
    new Map(
      Object.entries(FIXTURE).map(([path, text]) => [
        path.split('/').pop() ?? path,
        text.replaceAll(from, to),
      ]),
    ),
  );

test('the fixed release is read as it stands', () => {
  expect(changed('no such text', 'x').entities.length).toBeGreaterThan(0);
});

test.each([
  'javascript:alert(1)',
  'data:text/html;charset=utf-8',
  '//evil.example/x',
  '../manifest.json',
])('a contact address %s refuses the release', (address) => {
  expect(() => changed('https://example.org/report-an-error', address)).toThrow(SiteReleaseFault);
});

test.each(['..', 'a:b', 'index.html', 'a b'])(
  'a claim key "%s" that cannot be a path refuses the release',
  (key) => {
    expect(() => changed(`${VESSEL}/imo`, `${VESSEL}/${key}`)).toThrow(SiteReleaseFault);
  },
);

test('an entity identifier with a slash refuses the release', () => {
  expect(() => changed(VESSEL, 'ship/one')).toThrow(/holds a "\/"/u);
});

test('two claim keys that differ only by case refuse the release', () => {
  expect(() => changed(`${VESSEL}/flag`, `${VESSEL}/IMO`)).toThrow(/case/u);
});
