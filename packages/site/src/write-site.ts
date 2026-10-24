import { access, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { build, createServer } from 'vite';
import { z } from 'zod';

import { REPORT_FILES } from '@gab/release/report-files';
import { claimPage, entityPage, relationPage, vesselPage } from '@gab/release/site-paths';
import { readSiteRelease, type SiteRelease } from '@gab/release/site-release';
import { SiteReleaseFault } from '@gab/release/site-release-fault';

/** A site of the same release is in the folder already. */
export class SiteFolderExists extends Error {}

const REPOSITORY = resolve(import.meta.dirname, '../../..');
const CONFIG = join(REPOSITORY, 'vite.config.ts');
const PRERENDER = join(REPOSITORY, 'src/prerender.tsx');

/** The folder of the host where the site stands. Set `SITE_BASE` to a path that starts and ends
 * with a slash to put the site in a folder, as `/gab/`. The default is the root of the host. */
const baseOfSite = (): string => {
  const given = process.env['SITE_BASE'] ?? '/';
  if (!/^\/([\w.-]+\/)*$/u.test(given))
    throw new SiteReleaseFault(
      `SITE_BASE is "${given}". It must start and end with a slash, as "/" or "/gab/".`,
    );
  return given;
};

// A release build has no read service: the public host has none, and the application then reads
// the files of the release (ADR 0028). The value is fixed here, so a service address in the
// environment of the operator never goes into a file that is published.
const NO_READ_SERVICE = { 'import.meta.env.VITE_API_URL': '""' };

// The shell is the page of the build. Each page of the site is the shell with its own title and,
// for a page with a permanent address, its own markup in the root element.
const SHELL_ROOT = '<div id="root"></div>';
const SHELL_TITLE = /<title>[^<]*<\/title>/u;
const TITLE_SUFFIX = ' · GAB dataset';

// The pages that need a script and hold no permanent text: the shell opens them as it is.
const SCRIPT_PAGES = ['graph'] as const;

// The pages that an earlier release had, with the page that holds their content now. A link or a
// bookmark to one of them still opens a page.
const MOVED: readonly (readonly [folder: string, to: string, label: string])[] = [
  ['downloads', 'data', 'Data'],
  ['method', 'data', 'Data'],
  ['glossary', 'help', 'Help'],
  ['search', 'data', 'Data'],
  ['exports', 'report', 'Report'],
];

const fileManifest = z.object({
  files: z.array(z.object({ path: z.string().regex(/^[\w-][\w.-]*$/u) })),
});

const exists = async (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

/** The text of each file of a release folder that its file manifest lists, and of the file
 * manifest itself. */
const readReleaseFolder = async (folder: string): Promise<ReadonlyMap<string, string>> => {
  const manifest = await readFile(join(folder, 'manifest.json'), 'utf8').catch(() => {
    throw new SiteReleaseFault(`The folder ${folder} has no manifest.json.`);
  });
  let json: unknown;
  try {
    json = JSON.parse(manifest);
  } catch {
    throw new SiteReleaseFault('manifest.json: the file is not JSON');
  }
  const read = fileManifest.safeParse(json);
  if (!read.success)
    throw new SiteReleaseFault('manifest.json: the file is not the manifest of a release');
  const files = new Map([['manifest.json', manifest]]);
  for (const { path } of read.data.files)
    files.set(path, await readFile(join(folder, path), 'utf8'));
  return files;
};

/** The data files of the report. They are public and sit in the repository; `REPORT_DIR` names
 * another folder for a build that tests other values. */
const readReportFolder = async (): Promise<ReadonlyMap<string, string>> => {
  const named = process.env['REPORT_DIR'];
  const folder =
    named === undefined || named === '' ? resolve(import.meta.dirname, '../report') : named;
  const names = await readdir(folder, { withFileTypes: true }).catch(() => {
    throw new SiteReleaseFault(`The report folder ${folder} cannot be read.`);
  });
  const present = new Set(names.filter((one) => one.isFile()).map((one) => one.name));
  // Only the named files are public. Any other file of the folder stays on the machine.
  for (const name of Object.values(REPORT_FILES))
    if (!present.has(name))
      throw new SiteReleaseFault(`The report folder ${folder} holds no file ${name}.`);
  return new Map(
    await Promise.all(
      Object.values(REPORT_FILES).map(
        async (name) => [name, await readFile(join(folder, name), 'utf8')] as const,
      ),
    ),
  );
};

const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** One page of the site: the folder of its file from the root of the site (empty for the home
 * page), and how it opens. */
interface Page {
  readonly folder: string;
  /** `text`: the application renders it. `script`: the shell opens it as it is. `merged`: a short
   * page that sends the reader to the entity that survived a merge. `moved`: a short page at the
   * address of a page that the site no longer has, which sends the reader to its successor. */
  readonly kind: 'text' | 'script' | 'merged' | 'moved';
  readonly survivor?: { readonly folder: string; readonly label: string };
  /** The folder that the document sends the browser to, as the page of a relation does to its
   * claim. A reader with no script follows it too. */
  readonly sendsTo?: string;
}

const folderOf = (file: string): string => dirname(file);

/** Each page of the release at its permanent address, the address of the version 1 map, and the
 * pages that need a script. */
const pagesOf = (release: SiteRelease): readonly Page[] => {
  const pages: Page[] = [
    { folder: '', kind: 'text' },
    { folder: 'map', kind: 'text' },
    { folder: 'data', kind: 'text' },
    { folder: 'report', kind: 'text' },
    { folder: 'help', kind: 'text' },
    ...MOVED.map(([folder, to, label]) => ({
      folder,
      kind: 'moved' as const,
      survivor: { folder: to, label },
    })),
    ...SCRIPT_PAGES.map((folder) => ({ folder, kind: 'script' as const })),
  ];
  for (const entity of release.entities)
    pages.push({ folder: folderOf(entityPage(entity.id)), kind: 'text' });
  for (const imo of release.vesselsByImo.keys())
    pages.push({ folder: folderOf(vesselPage(imo)), kind: 'text' });
  for (const claim of release.claims)
    pages.push({ folder: folderOf(claimPage(claim.id)), kind: 'text' });
  for (const relation of release.relations)
    if (release.claimById.has(relation.id))
      pages.push({
        folder: folderOf(relationPage(relation.id)),
        kind: 'text',
        sendsTo: folderOf(claimPage(relation.id)),
      });
  for (const [absorbed, survivor] of release.aliases) {
    const target = release.entityById.get(survivor);
    if (target === undefined || release.entityById.has(absorbed)) continue;
    pages.push({
      folder: folderOf(entityPage(absorbed)),
      kind: 'merged',
      survivor: { folder: folderOf(entityPage(survivor)), label: target.label },
    });
  }
  return pages;
};

/** The page of a merged entity: one sentence and a link to the entity that holds its claims. The
 * document also sends the browser there, and the script of the application does the same. */
const refreshTo = (base: string, folder: string): string =>
  `<meta http-equiv="refresh" content="0; url=${escapeHtml(`${base}${folder}/`)}">`;

const movedPage = (base: string, survivor: NonNullable<Page['survivor']>) => {
  const target = escapeHtml(`${base}${survivor.folder}/`);
  return {
    head: refreshTo(base, survivor.folder),
    html:
      '<main><h1>This page has moved</h1><p>The content of this page is now on the page ' +
      `<a href="${target}">${escapeHtml(survivor.label)}</a>.</p></main>`,
  };
};

const mergedPage = (base: string, survivor: NonNullable<Page['survivor']>) => {
  const target = escapeHtml(`${base}${survivor.folder}/`);
  return {
    head: refreshTo(base, survivor.folder),
    html:
      '<main><h1>Merged entity</h1><p>A merge joined this entity to another entity, which now ' +
      `holds its claims: <a href="${target}">${escapeHtml(survivor.label)}</a></p></main>`,
  };
};

interface RenderedPage {
  readonly html: string;
  readonly title: string;
  readonly description: string | null;
}

interface Renderer {
  renderPage(address: string): Promise<RenderedPage>;
}

const isRenderer = (value: unknown): value is Renderer =>
  typeof value === 'object' &&
  value !== null &&
  'renderPage' in value &&
  typeof value.renderPage === 'function';

// The render runs in Node, so a relative address has no host and no `fetch` to answer it. This
// `fetch` answers the files of the release and refuses every other address, so the read service
// looks down and each page reads the release, as the built site does on a static host.
const NO_HOST = 'http://release.invalid/';

const releaseFetch =
  (
    files: ReadonlyMap<string, string>,
    report: ReadonlyMap<string, string>,
    base: string,
  ): typeof fetch =>
  (input) => {
    const address = new URL(
      typeof input === 'string' || input instanceof URL ? input : input.url,
      NO_HOST,
    );
    const prefix = `${base}release/`;
    const reportPrefix = `${base}report/`;
    if (address.origin !== new URL(NO_HOST).origin)
      return Promise.reject(new TypeError('The render at the release has no network.'));
    const [place, held] = address.pathname.startsWith(reportPrefix)
      ? ([reportPrefix, report] as const)
      : ([prefix, files] as const);
    if (!address.pathname.startsWith(place))
      return Promise.reject(new TypeError('The render at the release has no network.'));
    const text = held.get(decodeURIComponent(address.pathname.slice(place.length)));
    return Promise.resolve(
      text === undefined ? new Response(null, { status: 404 }) : new Response(text),
    );
  };

const setVariable = (name: string, value: string | undefined): void => {
  if (value === undefined) Reflect.deleteProperty(process.env, name);
  else process.env[name] = value;
};

/** Runs `work` with the variables of the environment that the build reads, and puts the old values
 * back. The release folder is the one input that the build takes from the environment
 * (vite.config.ts). The mode is production in every process, a test run included. */
const withBuildEnvironment = async <T>(
  releaseFolder: string | undefined,
  work: () => Promise<T>,
): Promise<T> => {
  const names = { RELEASE_DIR: releaseFolder, NODE_ENV: 'production' } as const;
  const held = Object.fromEntries(Object.keys(names).map((name) => [name, process.env[name]]));
  for (const [name, value] of Object.entries(names)) setVariable(name, value);
  try {
    return await work();
  } finally {
    for (const [name, value] of Object.entries(held)) setVariable(name, value);
  }
};

/** Builds the application in `target`, with a copy of each file of the release beside it. */
const buildApplication = (releaseFolder: string, target: string, base: string): Promise<void> =>
  withBuildEnvironment(releaseFolder, async () => {
    await build({
      root: REPOSITORY,
      configFile: CONFIG,
      logLevel: 'error',
      base,
      define: NO_READ_SERVICE,
      build: { outDir: target, emptyOutDir: true },
    });
  });

/** Renders each page that has a permanent text. Vite loads the application, because Node cannot
 * run its JSX and its routes. A page that is not found, or that has an error, is a fault and
 * never a page of the site. */
export const renderPages = (
  files: ReadonlyMap<string, string>,
  pages: readonly Page[],
  base: string,
  report: ReadonlyMap<string, string> = new Map(),
): Promise<ReadonlyMap<string, RenderedPage>> =>
  withBuildEnvironment(undefined, () => renderWithServer(files, pages, base, report));

const renderWithServer = async (
  files: ReadonlyMap<string, string>,
  pages: readonly Page[],
  base: string,
  report: ReadonlyMap<string, string>,
): Promise<ReadonlyMap<string, RenderedPage>> => {
  const server = await createServer({
    root: REPOSITORY,
    configFile: CONFIG,
    mode: 'production',
    base,
    define: NO_READ_SERVICE,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
  const fetchHeld = globalThis.fetch;
  globalThis.fetch = releaseFetch(files, report, base);
  try {
    const renderer: unknown = await server.ssrLoadModule(PRERENDER);
    if (!isRenderer(renderer)) throw new Error('the render of the pages did not load');
    const rendered = new Map<string, RenderedPage>();
    for (const page of pages)
      if (page.kind === 'text')
        rendered.set(page.folder, await renderer.renderPage(`/${page.folder}`));
    return rendered;
  } finally {
    globalThis.fetch = fetchHeld;
    await server.close();
  }
};

// External constraint: on Windows a scanner or an indexer can hold a file of a folder with
// thousands of files, and the rename then fails with EPERM or EBUSY for a few seconds.
const renameWithRetry = async (from: string, to: string): Promise<void> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await rename(from, to);
      return;
    } catch (cause) {
      const code = cause instanceof Error && 'code' in cause ? cause.code : undefined;
      if (attempt === 30 || (code !== 'EPERM' && code !== 'EBUSY')) throw cause;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
};

const writeSiteFolder = async (releaseFolder: string, siteFolder: string): Promise<void> => {
  if (await exists(siteFolder))
    throw new SiteFolderExists(
      `The site folder ${siteFolder} exists already. A release never writes over another site.`,
    );
  const base = baseOfSite();
  const files = await readReleaseFolder(releaseFolder);
  const report = await readReportFolder();
  const pages = pagesOf(readSiteRelease(files));

  await mkdir(dirname(siteFolder), { recursive: true });
  const partial = await mkdtemp(join(dirname(siteFolder), '.gab-site-'));
  try {
    await buildApplication(releaseFolder, partial, base);
    const shell = await readFile(join(partial, 'index.html'), 'utf8');
    if (!shell.includes(SHELL_ROOT) || !SHELL_TITLE.test(shell))
      throw new Error('the shell of the application has an unexpected form');
    const rendered = await renderPages(files, pages, base, report);
    for (const page of pages) {
      let text = shell;
      if (page.kind === 'moved' && page.survivor !== undefined) {
        const moved = movedPage(base, page.survivor);
        text = text
          .replace(SHELL_TITLE, () => `<title>Page moved${TITLE_SUFFIX}</title>`)
          .replace('</head>', () => `${moved.head}</head>`)
          .replace(SHELL_ROOT, () => `<div id="root">${moved.html}</div>`);
      } else if (page.kind === 'merged' && page.survivor !== undefined) {
        const merged = mergedPage(base, page.survivor);
        text = text
          .replace(SHELL_TITLE, () => `<title>Merged entity${TITLE_SUFFIX}</title>`)
          .replace('</head>', () => `${merged.head}</head>`)
          .replace(SHELL_ROOT, () => `<div id="root">${merged.html}</div>`);
      } else if (page.kind === 'text') {
        const one = rendered.get(page.folder);
        if (one === undefined) throw new Error(`the page ${page.folder} was not rendered`);
        text = text
          .replace(SHELL_TITLE, () => `<title>${escapeHtml(one.title)}</title>`)
          .replace('</head>', () =>
            [
              one.description === null
                ? ''
                : `<meta name="description" content="${escapeHtml(one.description)}" />`,
              page.sendsTo === undefined ? '' : refreshTo(base, page.sendsTo),
              '</head>',
            ].join(''),
          )
          .replace(SHELL_ROOT, () => `<div id="root">${one.html}</div>`);
      }
      const file = join(partial, page.folder, 'index.html');
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, text);
    }
    await renameWithRetry(partial, siteFolder);
  } catch (fault) {
    await rm(partial, { recursive: true, force: true });
    throw fault;
  }
};

/** Writes the site of the release in `releaseFolder` to `siteFolder`: the application, built once
 * with a copy of each file of the release under `release/`, and a file `<path>/index.html` for each
 * page. A page with a permanent address holds its text in the HTML, and the script of the
 * application takes over in the browser. The site is written in a hidden folder first and never
 * over an existing folder. */
export const writeSite = async (releaseFolder: string, siteFolder: string): Promise<void> => {
  try {
    await writeSiteFolder(releaseFolder, siteFolder);
  } catch (fault) {
    // Every fault of the build, of the render and of the files ends the release with a message
    // and not with an unhandled error. The message of the first fault stays.
    if (fault instanceof SiteFolderExists || fault instanceof SiteReleaseFault) throw fault;
    const why = fault instanceof Error ? fault.message : String(fault);
    throw new SiteReleaseFault(`The site cannot be built: ${why}`, { cause: fault });
  }
};
