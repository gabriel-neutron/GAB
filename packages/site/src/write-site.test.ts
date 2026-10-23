import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { beforeAll, describe, expect, test, vi } from 'vitest';

import { claimText } from '@gab/release/claim-text';
import { claimPage, entityPage, relationPage, vesselPage } from '@gab/release/site-paths';
import { readSiteRelease, type SiteRelease } from '@gab/release/site-release';
import { SiteReleaseFault } from '@gab/release/site-release-fault';
import { renderPages, SiteFolderExists, writeSite } from './write-site.ts';

// The build of the application and the render of every page take some seconds.
const BUILD_TIMEOUT = 180_000;

const FIXTURES = resolve(import.meta.dirname, '../fixtures');
const ABSORBED = '0a1f0000-0000-4000-8000-000000000005';

const filesOf = (folder: string): Map<string, string> =>
  new Map(readdirSync(folder).map((name) => [name, readFileSync(join(folder, name), 'utf8')]));

/** The text of an HTML page that a reader sees with no script: the tags, the scripts and the styles
 * are gone, and the entities are decoded. */
const textOf = (html: string): string =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gu, ' ')
    .replace(/<[^>]*>/gu, ' ')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replace(/\s+/gu, ' ');

interface Site {
  readonly root: string;
  readonly release: SiteRelease;
  /** The HTML file at one old address of the static site, as `<path>/index.html`. */
  readonly page: (path: string) => string;
}

const writeOf = async (fixture: string): Promise<Site> => {
  const root = join(mkdtempSync(join(tmpdir(), 'gab-site-')), 'site');
  await writeSite(join(FIXTURES, fixture), root);
  return {
    root,
    release: readSiteRelease(filesOf(join(FIXTURES, fixture))),
    page: (path) => readFileSync(join(root, path), 'utf8'),
  };
};

let off: Site;
let on: Site;

// A service address in the environment of the operator must not go into a site that is published.
const SERVICE = 'https://service.example.invalid';

beforeAll(async () => {
  vi.stubEnv('VITE_API_URL', SERVICE);
  off = await writeOf('release');
  on = await writeOf('release-nato');
  vi.unstubAllEnvs();
}, BUILD_TIMEOUT);

describe.each([
  ['off', () => off],
  ['on', () => on],
])('the site of the release with the pair %s', (_name, site) => {
  test('every page of the static site opens at its old address and holds its text', () => {
    const { release, page } = site();
    for (const entity of release.entities)
      expect(textOf(page(entityPage(entity.id)))).toContain(entity.label);
    for (const claim of release.claims)
      expect(textOf(page(claimPage(claim.id)))).toContain(claimText(claim));
    for (const imo of release.vesselsByImo.keys())
      expect(textOf(page(vesselPage(imo)))).toContain(`IMO ${imo}`);
    for (const relation of release.relations)
      if (release.claimById.has(relation.id))
        expect(textOf(page(relationPage(relation.id)))).toContain('has its page at its claim');
    expect(release.entities.length).toBeGreaterThan(0);
    expect(release.claims.length).toBeGreaterThan(0);
    expect(release.vesselsByImo.size).toBeGreaterThan(0);
  });

  test('the pages of the site have their text, and a title, outside any script', () => {
    const { page } = site();
    const expected: readonly (readonly [string, string, string])[] = [
      ['index.html', 'Critical nodes', 'Critical nodes · GAB dataset'],
      ['map/index.html', 'physical link', 'Map · GAB dataset'],
      ['data/index.html', 'SHA-256 checksum', 'Data · GAB dataset'],
      ['report/index.html', 'Les exportations russes', 'Report · GAB dataset'],
      ['v1/index.html', 'holds no build of the version 1 map', 'Version 1 · GAB dataset'],
    ];
    for (const [path, words, title] of expected) {
      expect(textOf(page(path))).toContain(words);
      expect(page(path)).toContain(`<title>${title}</title>`);
      expect(page(path)).toContain('<div id="root"><');
    }
  });

  test('the removed pages have no folder', () => {
    const { page } = site();
    for (const folder of ['search', 'downloads', 'method', 'exports', 'glossary', 'help'])
      expect(() => page(`${folder}/index.html`)).toThrow();
  });

  test('the footer of a page gives the version of the release', () => {
    const { release, page } = site();
    const [year, month, day] = release.manifest.date.split('-');
    expect(textOf(page('index.html'))).toContain(`Version of ${day}/${month}/${year}`);
  });

  test('a merged entity opens a short page that links the survivor and sends the browser there', () => {
    const { release, page } = site();
    const survivor = release.aliases.get(ABSORBED);
    expect(survivor).toBeDefined();
    const html = page(entityPage(ABSORBED));
    expect(html).toContain(`<meta http-equiv="refresh" content="0; url=/entity/${survivor}/">`);
    expect(html).toContain(`href="/entity/${survivor}/"`);
    expect(textOf(html)).toContain(release.entityById.get(survivor ?? '')?.label);
  });

  test('a relation page sends the browser to its claim with no script', () => {
    const { release, page } = site();
    const sent = release.relations.filter((one) => release.claimById.has(one.id));
    expect(sent.length).toBeGreaterThan(0);
    for (const relation of sent)
      expect(page(relationPage(relation.id))).toContain(
        `<meta http-equiv="refresh" content="0; url=/claim/${relation.id}/">`,
      );
  });

  test('the graph and the review open the shell, with no text of a record', () => {
    const { release, page } = site();
    for (const folder of ['graph', 'review']) {
      const html = page(`${folder}/index.html`);
      expect(html).toContain('<div id="root"></div>');
      expect(html).toContain('type="module"');
      for (const entity of release.entities) expect(textOf(html)).not.toContain(entity.label);
    }
  });

  test('every file of the release is copied byte for byte under release/', () => {
    const { root } = site();
    const fixture = join(FIXTURES, root === off.root ? 'release' : 'release-nato');
    for (const name of readdirSync(fixture))
      expect(
        readFileSync(join(root, 'release', name)).equals(readFileSync(join(fixture, name))),
      ).toBe(true);
  });

  test('the shell loads the script and the style of the build, and no service of the operator', () => {
    const { root, page } = site();
    const html = page('index.html');
    expect(html).toMatch(/<script type="module"[^>]*src="\/assets\/[^"]+\.js"/u);
    expect(html).toMatch(/<link rel="stylesheet"[^>]*href="\/assets\/[^"]+\.css"/u);
    expect(html).not.toContain('jsx-dev-runtime');
    expect(existsSync(join(root, 'assets', 'maplibre-gl-worker.mjs'))).toBe(true);
    expect(existsSync(join(root, 'assets', 'maplibre-gl-shared.mjs'))).toBe(true);
    for (const name of readdirSync(join(root, 'assets')).filter((one) => one.endsWith('.js')))
      expect(readFileSync(join(root, 'assets', name), 'utf8')).not.toContain(
        'service.example.invalid',
      );
  });
});

describe('a site that cannot be written', () => {
  test('a folder that exists is never written over', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'gab-site-'));
    await expect(writeSite(join(FIXTURES, 'release'), folder)).rejects.toThrow(SiteFolderExists);
  });

  test('a folder with no manifest is refused, and no site folder is left', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'gab-empty-'));
    const parent = mkdtempSync(join(tmpdir(), 'gab-site-'));
    mkdirSync(join(parent, 'inside'));
    const site = join(parent, 'inside', 'site');
    await expect(writeSite(empty, site)).rejects.toThrow(SiteReleaseFault);
    expect(readdirSync(join(parent, 'inside'))).toStrictEqual([]);
  });
});

describe('a page that cannot be rendered', () => {
  test(
    'the page of an unknown entity is a fault and never a page of the site',
    async () => {
      const files = filesOf(join(FIXTURES, 'release'));
      const page = { folder: 'entity/no-such-entity', kind: 'text' } as const;
      await expect(renderPages(files, [page], '/')).rejects.toThrow(/not found/u);
    },
    BUILD_TIMEOUT,
  );

  test(
    'the report page holds its figures in the HTML when the report folder gives their files',
    async () => {
      const files = filesOf(join(FIXTURES, 'release'));
      const report = filesOf(join(FIXTURES, 'report'));
      const page = { folder: 'report', kind: 'text' } as const;
      const rendered = await renderPages(files, [page], '/', report);
      const text = textOf(rendered.get('report')?.html ?? '');
      expect(text).toContain('Figure 2.');
      expect(text).toContain('Seller One');
      expect(text).not.toContain('is not on this site');
    },
    BUILD_TIMEOUT,
  );
});
