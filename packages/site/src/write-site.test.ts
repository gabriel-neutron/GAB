import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { beforeAll, describe, expect, test, vi } from 'vitest';

import { AI_CRAWLER_POLICY, AI_CRAWLERS } from '@gab/release/ai-policy';
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
  vi.stubEnv('SITE_RELEASE', '1');
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
      ['index.html', 'The problem.', 'The nodes that sustain Russia’s war in 2026 · GAB'],
      ['bibliography/index.html', 'Notes and sources', 'Report bibliography · GAB'],
      ['nodes/index.html', 'The labels', 'GAB dataset: release overview'],
      ['map/index.html', 'Map', 'Map · GAB dataset'],
      ['downloads/index.html', 'SHA-256 checksum', 'Downloads · GAB dataset'],
      ['method/index.html', 'What the labels mean', 'About · GAB dataset'],
      ['exports/index.html', 'Russian exports', 'Exports · GAB dataset'],
      ['glossary/index.html', 'point of view of the project', 'Glossary · GAB dataset'],
      ['help/index.html', 'How the facts are checked', 'Help · GAB dataset'],
    ];
    for (const [path, words, title] of expected) {
      expect(textOf(page(path))).toContain(words);
      expect(page(path)).toContain(`<title>${title}</title>`);
      expect(page(path)).toContain('<div id="root"><');
      expect(page(path)).toMatch(/<meta name="description" content="[^"]+" \/>/u);
    }
  });

  test('the report gives the version of the release', () => {
    const { release, page } = site();
    const [year, month, day] = release.manifest.date.split('-');
    expect(textOf(page('exports/index.html'))).toContain(
      `From the release of ${day}/${month}/${year}`,
    );
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

  test('the graph and the search open the shell, with no text of a record', () => {
    const { release, page } = site();
    for (const folder of ['graph', 'search']) {
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

/** Each page of the site as `<folder>/index.html`, with the folder of the page. */
const pagesOf = (root: string): readonly string[] =>
  (readdirSync(root, { recursive: true }) as string[])
    .map((one) => one.replaceAll('\\', '/'))
    .filter((one) => one.endsWith('index.html') && !one.startsWith('release/'));

const SITE = 'https://gab.example.org/';
const tagOf = (html: string, pattern: RegExp): string | undefined => pattern.exec(html)?.[1];

describe.each([
  ['off', () => off],
  ['on', () => on],
])('the files for crawlers of the release with the pair %s', (_name, site) => {
  test('the sitemap lists exactly the pages that a search result may hold, with absolute addresses', () => {
    const { release, root } = site();
    const xml = readFileSync(join(root, 'sitemap.xml'), 'utf8');
    const listed = [...xml.matchAll(/<loc>([^<]*)<\/loc>/gu)].map((one) => one[1]);
    const merged = [...release.aliases.keys()].filter((one) => !release.entityById.has(one));
    const hidden = new Set(['graph', 'search', ...merged.map((one) => `entity/${one}`)]);
    const expected = pagesOf(root)
      .map((one) => one.slice(0, -'index.html'.length).replace(/\/$/u, ''))
      .filter(
        (folder) =>
          !hidden.has(folder) &&
          !folder.startsWith('relation/') &&
          !readFileSync(join(root, folder, 'index.html'), 'utf8').includes('content="noindex'),
      )
      .map((folder) => (folder === '' ? SITE : `${SITE}${folder}/`));
    expect(listed.sort()).toStrictEqual(expected.sort());
    expect(listed).toHaveLength(
      10 + release.entities.length + release.vesselsByImo.size + release.claims.length,
    );
    expect(xml).toContain(`<lastmod>${release.manifest.date}</lastmod>`);
    expect(listed).toContain(`${SITE}ai-use/`);
  });

  test('robots.txt blocks no file, names the sitemap and gives the same AI policy as the AI page', () => {
    const { root, page } = site();
    const robots = readFileSync(join(root, 'robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${SITE}sitemap.xml`);
    const rule = AI_CRAWLER_POLICY === 'allow' ? 'Allow: /' : 'Disallow: /';
    for (const name of AI_CRAWLERS) expect(robots).toContain(`User-agent: ${name}\n${rule}`);
    expect(robots).not.toMatch(/^Disallow: \/\S/mu);
    expect(textOf(page('ai-use/index.html'))).toContain(
      AI_CRAWLER_POLICY === 'allow'
        ? 'An AI system may read this site'
        : 'does not allow the known AI crawlers',
    );
  });

  test('llms.txt has absolute addresses of the pages and of each file of the release', () => {
    const { release, root } = site();
    const text = readFileSync(join(root, 'llms.txt'), 'utf8');
    expect(text.startsWith('# GAB dataset')).toBe(true);
    expect(text).toContain(`(${SITE}ai-use/)`);
    for (const file of release.manifest.files)
      expect(text).toContain(`(${SITE}release/${file.path})`);
    for (const address of text.matchAll(/\((\S+?)\)/gu))
      expect(address[1]).toMatch(/^https:\/\/gab\.example\.org\//u);
  });

  test('the AI use page is in the footer of a page', () => {
    const { page } = site();
    expect(page('help/index.html')).toMatch(/<footer[^>]*>.*href="\/ai-use"/su);
    expect(textOf(page('ai-use/index.html'))).toContain('How to cite a claim');
  });

  test('each page has a unique title, a description and a canonical address', () => {
    const { root, page } = site();
    const titles = new Set<string>();
    const pages = pagesOf(root);
    expect(pages.length).toBeGreaterThan(20);
    for (const file of pages) {
      const html = page(file);
      const title = tagOf(html, /<title>([^<]*)<\/title>/u);
      expect(title).toBeDefined();
      expect(titles.has(title ?? '')).toBe(false);
      titles.add(title ?? '');
      expect(html).toMatch(/<meta name="description" content="[^"]+" \/>/u);
      const folder = file.slice(0, -'index.html'.length);
      if (html.includes('content="noindex')) {
        expect(html).not.toContain('rel="canonical"');
        continue;
      }
      expect(html).toContain(
        `<link rel="canonical" href="${folder === '' ? SITE : `${SITE}${folder}`}" />`,
      );
      for (const property of ['og:title', 'og:description', 'og:url', 'og:image'])
        expect(html).toContain(`<meta property="${property}"`);
      expect(html).toContain(`<meta property="og:image" content="${SITE}og-image.png" />`);
      for (const name of ['card', 'title', 'description', 'image'])
        expect(html).toContain(`<meta name="twitter:${name}"`);
    }
  });

  test('a page with no data, or a page that sends the reader on, is marked noindex', () => {
    const { release, page } = site();
    for (const file of ['graph/index.html', 'search/index.html', entityPage(ABSORBED)])
      expect(page(file)).toContain('<meta name="robots" content="noindex, follow" />');
    for (const relation of release.relations)
      if (release.claimById.has(relation.id))
        expect(page(relationPage(relation.id))).toContain('content="noindex');
    expect(page('index.html')).not.toContain('noindex');
    expect(page(entityPage(release.entities[0]?.id ?? ''))).not.toContain('noindex');
  });

  test('the home page holds a Dataset with the licence, the date, the files and the contacts', () => {
    const { release, page } = site();
    const json = tagOf(
      page('index.html'),
      /<script type="application\/ld\+json">(.*?)<\/script>/su,
    );
    const dataset = JSON.parse(json ?? 'null') as Record<string, unknown>;
    expect(dataset['@type']).toBe('Dataset');
    expect(dataset['name']).toBeTruthy();
    expect(dataset['description']).toBeTruthy();
    expect(dataset['license']).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(dataset['dateModified']).toBe(release.manifest.date);
    expect(dataset['distribution']).toHaveLength(release.manifest.files.length);
    expect((dataset['publisher'] as { contactPoint: unknown[] }).contactPoint).toHaveLength(2);
    const entity = release.entities[0];
    expect(page(entityPage(entity?.id ?? ''))).toContain(`"name":${JSON.stringify(entity?.label)}`);
  });

  test('the icons, the manifest and the links to them are in the site and have the right types', () => {
    const { root, page } = site();
    const html = page('index.html');
    for (const file of [
      'favicon.svg',
      'favicon.ico',
      'apple-touch-icon.png',
      'icon-192.png',
      'icon-512.png',
      'site.webmanifest',
      'og-image.png',
    ])
      expect(statSync(join(root, file)).size).toBeGreaterThan(0);
    for (const href of html.matchAll(
      /<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*href="([^"]+)"/gu,
    ))
      expect(existsSync(join(root, (href[1] ?? '').slice(1)))).toBe(true);
    expect(html).toContain(
      '<meta name="theme-color" content="#101010" media="(prefers-color-scheme: dark)" />',
    );
    const manifest = JSON.parse(readFileSync(join(root, 'site.webmanifest'), 'utf8')) as {
      name: string;
      icons: { src: string; sizes: string }[];
    };
    expect(manifest.name).toBeTruthy();
    for (const icon of manifest.icons) expect(existsSync(join(root, icon.src))).toBe(true);
    expect(manifest.icons.map((one) => one.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    );
  });
});

describe('the files for crawlers in other builds', () => {
  test(
    'a staging build marks every page noindex, and a release build does not',
    async () => {
      vi.stubEnv('SITE_RELEASE', '');
      vi.stubEnv('WORKERS_CI_BRANCH', '');
      let staging: Site;
      try {
        staging = await writeOf('release');
      } finally {
        vi.unstubAllEnvs();
      }
      for (const file of pagesOf(staging.root))
        expect(staging.page(file)).toContain('<meta name="robots" content="noindex, follow" />');
      expect(readFileSync(join(staging.root, 'sitemap.xml'), 'utf8')).not.toContain('<loc>');
      expect(readFileSync(join(staging.root, 'robots.txt'), 'utf8')).toContain(
        'User-agent: *\nDisallow: /\n',
      );
      expect(readFileSync(join(staging.root, '_headers'), 'utf8')).toContain(
        'X-Robots-Tag: noindex',
      );
      expect(off.page('index.html')).not.toContain('noindex');
      expect(existsSync(join(off.root, '_headers'))).toBe(false);
    },
    BUILD_TIMEOUT,
  );

  test(
    'a build for a folder of a host keeps the folder in each absolute address and each link',
    async () => {
      vi.stubEnv('SITE_BASE', '/gab/');
      vi.stubEnv('SITE_RELEASE', '1');
      let folder: Site;
      try {
        folder = await writeOf('release');
      } finally {
        vi.unstubAllEnvs();
      }
      const base = `${SITE}gab/`;
      expect(readFileSync(join(folder.root, 'sitemap.xml'), 'utf8')).toContain(
        `<loc>${base}ai-use/</loc>`,
      );
      expect(readFileSync(join(folder.root, 'robots.txt'), 'utf8')).toContain(
        `Sitemap: ${base}sitemap.xml`,
      );
      expect(readFileSync(join(folder.root, 'llms.txt'), 'utf8')).toContain(`(${base}release/`);
      const html = folder.page('help/index.html');
      expect(html).toContain(`<link rel="canonical" href="${base}help/" />`);
      expect(html).toContain(`content="${base}og-image.png"`);
      expect(html).toContain('href="/gab/favicon.svg"');
      expect(html).toContain('href="/gab/site.webmanifest"');
    },
    BUILD_TIMEOUT,
  );

  test(
    'a release with no iriBase writes robots.txt and no sitemap, no llms.txt and no absolute tag',
    async () => {
      const release = mkdtempSync(join(tmpdir(), 'gab-release-'));
      for (const [name, text] of filesOf(join(FIXTURES, 'release')))
        writeFileSync(
          join(release, name),
          name === 'manifest.json'
            ? text.replace('"iriBase": "https://gab.example.org/"', '"iriBase": ""')
            : text,
        );
      const root = join(mkdtempSync(join(tmpdir(), 'gab-site-')), 'site');
      const note = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        await writeSite(release, root);
        expect(note).toHaveBeenCalledWith(expect.stringContaining('has no usable iriBase'));
      } finally {
        note.mockRestore();
      }
      expect(existsSync(join(root, 'robots.txt'))).toBe(true);
      expect(readFileSync(join(root, 'robots.txt'), 'utf8')).not.toContain('Sitemap');
      for (const name of ['sitemap.xml', 'llms.txt'])
        expect(existsSync(join(root, name))).toBe(false);
      const html = readFileSync(join(root, 'help/index.html'), 'utf8');
      expect(html).not.toContain('rel="canonical"');
      expect(html).toMatch(/<meta name="description" content="[^"]+" \/>/u);
    },
    BUILD_TIMEOUT,
  );
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
    'the exports page holds its figures in the HTML when the report folder gives their files',
    async () => {
      const files = filesOf(join(FIXTURES, 'release'));
      const report = filesOf(join(FIXTURES, 'report'));
      const page = { folder: 'exports', kind: 'text' } as const;
      const rendered = await renderPages(files, [page], '/', report);
      const text = textOf(rendered.get('exports')?.html ?? '');
      expect(text).toContain('Figure 2.');
      expect(text).toContain('Seller One');
      expect(text).not.toContain('is not on this site');
    },
    BUILD_TIMEOUT,
  );
});
