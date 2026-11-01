// The data release of the deployed site. The host builds from the repository, and a release is not
// a file of the repository, so a build with no RELEASE_DIR downloads the release that this file
// pins from the GitHub release of the same tag. Change the tag to deploy another release.

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

import type { Plugin } from 'vite';

export const DATA_RELEASE_TAG = 'data-2026-10-28';

const ASSETS = `https://github.com/gabriel-neutron/GAB/releases/download/${DATA_RELEASE_TAG}/`;

// External constraint: the host serves no static file larger than 25 MiB. The GitHub release
// holds each larger file alone, and the site sends the reader there.
const HOST_FILE_LIMIT = 25 * 1024 * 1024;

/** Downloads and unpacks the pinned release once, and gives its folder. */
export const fetchDataRelease = async (root: string): Promise<string> => {
  const folder = resolve(root, 'node_modules/.cache/gab-release', DATA_RELEASE_TAG);
  if (existsSync(folder)) return folder;
  // The folder takes its name only when it is complete: a stopped build leaves no half release.
  const partial = `${folder}.partial`;
  rmSync(partial, { recursive: true, force: true });
  mkdirSync(partial, { recursive: true });
  const answer = await fetch(`${ASSETS}release.tar.gz`);
  if (!answer.ok)
    throw new Error(`The data release ${DATA_RELEASE_TAG} answered ${answer.status}.`);
  writeFileSync(join(partial, '.release.tar.gz'), Buffer.from(await answer.arrayBuffer()));
  // A relative name: GNU tar reads `C:` in a Windows path as the name of a remote host.
  execFileSync('tar', ['-xzf', '.release.tar.gz'], { cwd: partial });
  rmSync(join(partial, '.release.tar.gz'));
  renameSync(partial, folder);
  return folder;
};

/** The files of the folder that the host can serve. */
export const servedFiles = (folder: string): readonly string[] =>
  readdirSync(folder).filter(
    (name) => !name.startsWith('.') && statSync(join(folder, name)).size <= HOST_FILE_LIMIT,
  );

/** The `_redirects` file that sends each file too large for the host to its GitHub release. */
export const largeFileRedirects = (folder: string): Plugin => ({
  name: 'gab-large-file-redirects',
  apply: 'build',
  generateBundle() {
    const served = new Set(servedFiles(folder));
    const large = readdirSync(folder).filter((name) => !name.startsWith('.') && !served.has(name));
    if (large.length === 0) return;
    const source = large.map((name) => `/release/${name} ${ASSETS}${name} 302\n`).join('');
    this.emitFile({ type: 'asset', fileName: '_redirects', source });
  },
});
