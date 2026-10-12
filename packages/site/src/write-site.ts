import {
  access,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { build, createServer } from 'vite';
import { z } from 'zod';

import { MAP_SCRIPT, V1 } from './site-paths.ts';
import { SiteReleaseFault } from './site-release-fault.ts';

/** A site of the same release is in the folder already. */
export class SiteFolderExists extends Error {}

const REPOSITORY = resolve(import.meta.dirname, '../../..');
const BUILDER = resolve(import.meta.dirname, 'build-site.tsx');
const MAP_ENTRY = resolve(import.meta.dirname, 'map-script.ts');

// The site takes the one stylesheet of the application, so it paints with the same tokens and
// no second palette exists. Tailwind builds the classes that the repository uses.
const STYLESHEET = '/src/index.css?inline';

const V1_PROJECT = 'project.gpkg';

// External constraint: MapLibre loads its worker from the address of its own module, beside it,
// so its three modules and its stylesheet go to the assets folder as they are.
const MAPLIBRE_FILES = [
  'maplibre-gl.mjs',
  'maplibre-gl-shared.mjs',
  'maplibre-gl-worker.mjs',
  'maplibre-gl.css',
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

// The worker type-checks this file with no JSX and no DOM, so the shape of the builder is stated
// here and not imported from its file.
type BuildSite = (
  files: ReadonlyMap<string, string>,
  style: string,
  withV1: boolean,
) => readonly { readonly path: string; readonly text: string }[];

const isBuilder = (value: unknown): value is BuildSite => typeof value === 'function';

/** Loads the page components through Vite, which compiles the JSX that Node cannot run, and builds
 * the stylesheet with Tailwind. */
const renderSite = async (files: ReadonlyMap<string, string>, withV1: boolean) => {
  const server = await createServer({
    configFile: false,
    root: REPOSITORY,
    plugins: [tailwindcss()],
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true },
  });
  try {
    const builder: unknown = (await server.ssrLoadModule(BUILDER))['buildSite'];
    const style: unknown = (await server.ssrLoadModule(STYLESHEET))['default'];
    if (!isBuilder(builder) || typeof style !== 'string')
      throw new Error('the site builder or the stylesheet did not load');
    return builder(files, style, withV1);
  } finally {
    await server.close();
  }
};

/** The map script as one module that imports MapLibre from beside it. */
const mapScript = async (): Promise<string> => {
  const output = await build({
    configFile: false,
    root: REPOSITORY,
    logLevel: 'error',
    build: {
      write: false,
      minify: true,
      lib: { entry: MAP_ENTRY, formats: ['es'], fileName: 'map' },
      rolldownOptions: {
        external: ['maplibre-gl'],
        output: { paths: { 'maplibre-gl': './maplibre-gl.mjs' } },
      },
    },
  });
  const results = Array.isArray(output) ? output : [output];
  for (const result of results)
    if ('output' in result)
      for (const chunk of result.output) if (chunk.type === 'chunk') return chunk.code;
  throw new Error('the map script did not build');
};

/** Writes the static site of the release in `releaseFolder` to `siteFolder`: each page, a copy of
 * each file of the release, the stylesheet, the map script with MapLibre, and the old site of
 * version 1 from `v1Folder` under `v1/` when it is given, with its demonstration project at the
 * root. The site is written in a hidden folder
 * first and never over an existing folder. */
export const writeSite = async (
  releaseFolder: string,
  siteFolder: string,
  v1Folder: string | null,
): Promise<void> => {
  if (await exists(siteFolder))
    throw new SiteFolderExists(
      `The site folder ${siteFolder} exists already. A release never writes over another site.`,
    );
  if (v1Folder !== null && !(await exists(join(v1Folder, basename(V1)))))
    throw new SiteReleaseFault(`The folder ${v1Folder} holds no index.html of version 1.`);
  const files = await readReleaseFolder(releaseFolder);
  const site = await renderSite(files, v1Folder !== null);
  const script = await mapScript();
  const maplibre = dirname(fileURLToPath(import.meta.resolve('maplibre-gl')));

  await mkdir(dirname(siteFolder), { recursive: true });
  const partial = await mkdtemp(join(dirname(siteFolder), '.gab-site-'));
  try {
    for (const file of site) {
      await mkdir(dirname(join(partial, file.path)), { recursive: true });
      await writeFile(join(partial, file.path), file.text);
    }
    for (const path of files.keys()) await copyFile(join(releaseFolder, path), join(partial, path));
    await writeFile(join(partial, MAP_SCRIPT), script);
    for (const name of MAPLIBRE_FILES)
      await copyFile(join(maplibre, name), join(partial, dirname(MAP_SCRIPT), name));
    if (v1Folder !== null) {
      await cp(v1Folder, join(partial, dirname(V1)), { recursive: true });
      // External constraint: the build of version 1 reads its demonstration project at the root
      // of the host, so the root holds a copy of it.
      const project = join(v1Folder, V1_PROJECT);
      if (await exists(project)) await copyFile(project, join(partial, V1_PROJECT));
    }
    await rename(partial, siteFolder);
  } catch (fault) {
    await rm(partial, { recursive: true, force: true });
    throw fault;
  }
};
