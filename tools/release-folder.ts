// The files of one release, served by the dev server and the preview server, and copied beside the
// application at the build (ADR 0028). The application reads them when the read service does not
// answer. No folder named means no release: the application then has no files to fall back on.
// The report folder is served the same way, under its own name.

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { REPORT_FILES } from '@gab/release/report-files';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';

const TYPES: Readonly<Record<string, string>> = {
  '.json': 'application/json',
  '.jsonld': 'application/ld+json',
  '.csv': 'text/csv; charset=utf-8',
  '.geojson': 'application/geo+json',
  '.md': 'text/markdown; charset=utf-8',
};

const typeOf = (name: string): string =>
  TYPES[name.slice(name.lastIndexOf('.'))] ?? 'application/octet-stream';

const filesOf = (folder: string, only?: readonly string[]): readonly string[] =>
  readdirSync(folder, { withFileTypes: true })
    .filter((one) => one.isFile() && !one.name.startsWith('.'))
    .map((one) => one.name)
    .filter((name) => only === undefined || only.includes(name));

/** The files that the build copies beside the application, each one a copy byte for byte. */
export const releaseAssets = (
  folder: string,
  directory = 'release',
  only?: readonly string[],
): readonly { readonly fileName: string; readonly source: Buffer }[] =>
  filesOf(folder, only).map((name) => ({
    fileName: `${directory}/${name}`,
    source: readFileSync(join(folder, name)),
  }));

const folderPlugin = (
  name: string,
  directory: string,
  folder: string | undefined,
  only?: readonly string[],
): Plugin => {
  const prefix = `/${directory}/`;
  const root = folder === undefined || folder === '' ? null : resolve(folder);
  const serve = ({ middlewares }: ViteDevServer | PreviewServer): void => {
    if (root === null) return;
    const names = new Set(filesOf(root, only));
    middlewares.use((request, reply, next) => {
      const address = request.url ?? '';
      const file = address.split('?')[0]?.slice(prefix.length) ?? '';
      if (!address.startsWith(prefix) || !names.has(file)) {
        next();
        return;
      }
      reply.setHeader('Content-Type', typeOf(file));
      reply.end(readFileSync(join(root, file)));
    });
  };
  return {
    name,
    configureServer: (server) => {
      serve(server);
    },
    configurePreviewServer: (server) => {
      serve(server);
    },
    generateBundle() {
      if (root === null) return;
      for (const { fileName, source } of releaseAssets(root, directory, only))
        this.emitFile({ type: 'asset', fileName, source });
    },
  };
};

export const releaseFolder = (folder: string | undefined, only?: readonly string[]): Plugin =>
  folderPlugin('gab-release-folder', 'release', folder, only);

/** The data files of the report, beside the application under `report/`. They sit in the
 * repository, and `REPORT_DIR` names another folder when a build needs other values. */
export const reportFolder = (folder: string | undefined): Plugin =>
  folderPlugin('gab-report-folder', 'report', folder, Object.values(REPORT_FILES));
