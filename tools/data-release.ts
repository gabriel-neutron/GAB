// The data release of the deployed site. The host builds from the repository, and a release is not
// a file of the repository, so a build with no RELEASE_DIR downloads the release that this file
// pins from the GitHub release of the same tag. Change the tag and the checksum to deploy another
// release: a release asset can be replaced under the same tag, so the checksum fixes the bytes.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

import type { Plugin } from 'vite';
import { z } from 'zod';

export const DATA_RELEASE_TAG = 'data-2026-10-28';
/** The SHA-256 of release.tar.gz of the tag. */
export const DATA_RELEASE_SHA256 =
  '8896410d0eaea285c72e28798ae1fa7c5ea57d0f369dad3791c0acda04101084';

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
  const archive = Buffer.from(await answer.arrayBuffer());
  const found = sha256Of(archive);
  if (found !== DATA_RELEASE_SHA256)
    throw new Error(
      `The data release ${DATA_RELEASE_TAG} has the SHA-256 ${found}, not the pinned one.`,
    );
  writeFileSync(join(partial, '.release.tar.gz'), archive);
  // A relative name: GNU tar reads `C:` in a Windows path as the name of a remote host.
  execFileSync('tar', ['-xzf', '.release.tar.gz'], { cwd: partial });
  rmSync(join(partial, '.release.tar.gz'));
  listedFiles(partial);
  renameSync(partial, folder);
  return folder;
};

const sha256Of = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

const manifestFiles = z.object({
  files: z.array(
    z.object({
      path: z.string().regex(/^[\w-][\w.-]*$/u),
      sha256: z.string().regex(/^[0-9a-f]{64}$/u),
    }),
  ),
});

/** The files that manifest.json of the folder lists, and manifest.json. Only these are published: a
 * file beside them that the release writer did not write never reaches the site. Throws when the
 * manifest is absent. With `verify`, it also throws when a listed file is absent or has another
 * checksum. */
export const listedFiles = (folder: string, verify = true): readonly string[] => {
  const at = join(folder, 'manifest.json');
  if (!existsSync(at))
    throw new Error(`The release folder ${folder} has no manifest.json at its top.`);
  const { files } = manifestFiles.parse(JSON.parse(readFileSync(at, 'utf8')));
  for (const { path, sha256 } of verify ? files : []) {
    const file = join(folder, path);
    if (!existsSync(file) || sha256Of(readFileSync(file)) !== sha256)
      throw new Error(`The release file ${path} is absent or does not match its manifest.`);
  }
  return ['manifest.json', ...files.map((one) => one.path)];
};

/** The listed files of the folder that the host can serve. */
export const servedFiles = (folder: string, verify = true): readonly string[] =>
  listedFiles(folder, verify).filter(
    (name) => statSync(join(folder, name)).size <= HOST_FILE_LIMIT,
  );

/** The `_redirects` file that sends each file too large for the host to its GitHub release. */
export const largeFileRedirects = (folder: string): Plugin => ({
  name: 'gab-large-file-redirects',
  apply: 'build',
  generateBundle() {
    const served = new Set(servedFiles(folder, false));
    const large = listedFiles(folder, false).filter((name) => !served.has(name));
    if (large.length === 0) return;
    const source = large.map((name) => `/release/${name} ${ASSETS}${name} 302\n`).join('');
    this.emitFile({ type: 'asset', fileName: '_redirects', source });
  },
});
