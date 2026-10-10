import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix, relative, resolve } from 'node:path';

import { beforeAll, describe, expect, test } from 'vitest';
import { z } from 'zod';

import { writeSite } from './write-site.ts';

const FIXTURES = resolve(import.meta.dirname, '../fixtures');
const VESSEL = '0a1f0000-0000-4000-8000-000000000001';
const ABSORBED = '0a1f0000-0000-4000-8000-000000000005';

const filesOf = (root: string): readonly string[] =>
  readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((one) => statSync(join(root, one)).isFile())
    .map((one) => one.split('\\').join('/'));

interface Site {
  readonly root: string;
  readonly files: readonly string[];
  readonly pages: readonly string[];
  readonly read: (path: string) => string;
}

const writeOf = async (fixture: string, v1: string | null): Promise<Site> => {
  const root = join(mkdtempSync(join(tmpdir(), 'gab-site-')), 'site');
  await writeSite(join(FIXTURES, fixture), root, v1);
  const files = filesOf(root);
  return {
    root,
    files,
    pages: files.filter((one) => one.endsWith('.html') && !one.startsWith('v1/')),
    read: (path) => readFileSync(join(root, path), 'utf8'),
  };
};

let off: Site;
let on: Site;

beforeAll(async () => {
  const v1 = mkdtempSync(join(tmpdir(), 'gab-v1-'));
  writeFileSync(join(v1, 'index.html'), '<!doctype html><title>v1 stub</title>');
  mkdirSync(join(v1, 'assets'));
  writeFileSync(join(v1, 'assets', 'app.js'), 'export {};');
  off = await writeOf('release', v1);
  on = await writeOf('release-nato', null);
}, 60_000);

describe.each([
  ['off', () => off],
  ['on', () => on],
])('the site of the release with the pair %s', (_name, site) => {
  test('each page type exists, with a page for each entity and each claim', () => {
    const { files } = site();
    for (const page of [
      'index.html',
      'map/index.html',
      'downloads/index.html',
      'method/index.html',
      `entity/${VESSEL}/index.html`,
      `claim/${VESSEL}/imo/index.html`,
      'claim/0a1f0000-0000-4000-8000-000000000012/index.html',
      `entity/${ABSORBED}/index.html`,
      'v1/index.html',
      'entities.csv',
      'manifest.json',
      'changelog.csv',
    ])
      expect(files).toContain(page);
  });

  test('each relative link of each page opens a file of the site', () => {
    const { files, pages, read } = site();
    for (const page of pages)
      for (const [, address = ''] of read(page).matchAll(/(?:href|src)="([^"]*)"/gu)) {
        if (/^(https:|mailto:)/u.test(address)) continue;
        const target = posix.normalize(
          posix.join(posix.dirname(page), decodeURIComponent(address)),
        );
        expect(files).toContain(target);
      }
  });

  test('no page reads an API: each address out of the site is a source or a contact', () => {
    const { pages, read } = site();
    for (const page of pages)
      for (const [, address = ''] of read(page).matchAll(/(?:href|src)="(https:[^"]*)"/gu))
        expect(address).toMatch(
          /^https:\/\/(example\.org|news\.example\.org|eur-lex\.europa\.eu)\//u,
        );
  });

  test('each page gives the day of the version and the two contact links, and never "live"', () => {
    const { pages, read } = site();
    for (const page of pages) {
      const text = read(page);
      expect(text).toContain('Version of 08/11/2026');
      expect(text).toContain('href="https://example.org/report-an-error">Report an error');
      expect(text).toContain('href="mailto:reply@example.org">Right of reply');
      expect(text).not.toMatch(/\blive\b/iu);
    }
  });

  test('a claim has a permanent page with its excerpt and its source', () => {
    const text = site().read(`claim/${VESSEL}/imo/index.html`);
    expect(text).toContain('SEVERNAYA VOLNA, IMO 9000001');
    expect(text).toContain('Council Implementing Regulation (EU) 2025/0000');
    expect(text).toContain('https://eur-lex.europa.eu/eli/reg_impl/2025/0000/oj');
    expect(text).toContain('2026-09-30');
    expect(text).toContain('Page 4');
    expect(text).toContain('CC-BY 4.0');
    expect(text).toContain('Accepted by rule strong_sources v2 — no person read it');
    expect(text).toContain(`https://gab.example.org/claim/${VESSEL}/imo`);
  });

  test('the address of a merged entity sends the reader to the survivor', () => {
    const text = site().read(`entity/${ABSORBED}/index.html`);
    expect(text).toContain(`content="0; url=../../entity/${VESSEL}/index.html"`);
    expect(text).toContain('Severnaya Volna');
  });

  test('the home page gives the retained node first, with "not sourced" for a tick with no claim', () => {
    const text = site().read('index.html');
    expect(text.indexOf('Retained nodes')).toBeLessThan(text.indexOf('Other candidate nodes'));
    expect(text).toContain('not sourced');
    expect(text).toContain('Ship-to-ship transfer off Gabon');
  });

  test('the downloads page gives each file with its checksum and the changelog summary', () => {
    const text = site().read('downloads/index.html');
    const { files } = z
      .object({ files: z.array(z.object({ path: z.string(), sha256: z.string() })) })
      .parse(JSON.parse(site().read('manifest.json')));
    expect(files.length).toBeGreaterThan(0);
    for (const { path, sha256 } of files) {
      expect(text).toContain(`href="../${path}"`);
      expect(text).toContain(sha256);
    }
    expect(text).toContain('Changes since the version of 01/10/2026 (0.9).');
    expect(text).toContain('href="../changelog.csv"');
  });

  test('each copy of a release file has the bytes of the release', () => {
    for (const name of ['claims.csv', 'entities.geojson', 'manifest.json'])
      expect(readFileSync(join(site().root, name))).toStrictEqual(
        readFileSync(join(FIXTURES, site() === off ? 'release' : 'release-nato', name)),
      );
  });
});

test('with the pair off, no page shows a letter or a digit of the pair', () => {
  for (const page of off.pages) {
    const text = off.read(page);
    expect(text).not.toMatch(/\b[A-F][1-6]\b|NATO|data-nato-pair/u);
  }
});

test('with the pair on, the pair shows next to each claim that has one, and the method explains it', () => {
  expect(on.read(`claim/${VESSEL}/imo/index.html`)).toMatch(/NATO A<!-- -->2|NATO A2/u);
  expect(on.read(`entity/${VESSEL}/index.html`)).toContain('data-nato-pair');
  expect(on.read('index.html')).toContain('data-nato-pair');
  expect(on.read('method/index.html')).toContain('STANAG 2511');
  expect(off.read('method/index.html')).not.toContain('STANAG');
});

test('the old site of version 1 is copied under v1, and with none a page says so', () => {
  expect(off.read('v1/index.html')).toContain('v1 stub');
  expect(off.files).toContain('v1/assets/app.js');
  expect(on.read('v1/index.html')).toContain('holds no build of the version 1 map');
  expect(relative(dirname(on.root), on.root)).toBe('site');
});

test('a second site in the same folder is refused', async () => {
  await expect(writeSite(join(FIXTURES, 'release'), off.root, null)).rejects.toThrow(
    /exists already/u,
  );
});
