// The files of one release, served by the dev server and the preview server, and copied beside the
// application at the build (ADR 0028). The application reads them when the read service does not
// answer. No folder named means no release: the application then has no files to fall back on.

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { Plugin, PreviewServer, ViteDevServer } from 'vite';

const PREFIX = '/release/';

const TYPES: Readonly<Record<string, string>> = {
  '.json': 'application/json',
  '.jsonld': 'application/ld+json',
  '.csv': 'text/csv; charset=utf-8',
  '.geojson': 'application/geo+json',
  '.md': 'text/markdown; charset=utf-8',
};

const typeOf = (name: string): string =>
  TYPES[name.slice(name.lastIndexOf('.'))] ?? 'application/octet-stream';

const filesOf = (folder: string): readonly string[] =>
  readdirSync(folder, { withFileTypes: true })
    .filter((one) => one.isFile() && !one.name.startsWith('.'))
    .map((one) => one.name);

/** The files that the build copies beside the application, each one a copy byte for byte. */
export const releaseAssets = (
  folder: string,
): readonly { readonly fileName: string; readonly source: Buffer }[] =>
  filesOf(folder).map((name) => ({
    fileName: `release/${name}`,
    source: readFileSync(join(folder, name)),
  }));

export function releaseFolder(folder: string | undefined): Plugin {
  const root = folder === undefined || folder === '' ? null : resolve(folder);
  const serve = ({ middlewares }: ViteDevServer | PreviewServer): void => {
    if (root === null) return;
    const names = new Set(filesOf(root));
    middlewares.use((request, reply, next) => {
      const address = request.url ?? '';
      const name = address.split('?')[0]?.slice(PREFIX.length) ?? '';
      if (!address.startsWith(PREFIX) || !names.has(name)) {
        next();
        return;
      }
      reply.setHeader('Content-Type', typeOf(name));
      reply.end(readFileSync(join(root, name)));
    });
  };
  return {
    name: 'gab-release-folder',
    configureServer: (server) => {
      serve(server);
    },
    configurePreviewServer: (server) => {
      serve(server);
    },
    generateBundle() {
      if (root === null) return;
      for (const { fileName, source } of releaseAssets(root))
        this.emitFile({ type: 'asset', fileName, source });
    },
  };
}
