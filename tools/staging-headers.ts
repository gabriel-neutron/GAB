// The host serves the build of each branch at a public address. A staging build writes a `_headers`
// file at the root of the build, so the host tells a search engine not to index any response.

import { isReleaseBuild, STAGING_HEADERS } from '@gab/release/site-crawl';
import type { Plugin } from 'vite';

/** The `_headers` file of a build with these variables, or null for a release build. */
export const headersOf = (env: Readonly<Record<string, string | undefined>>): string | null =>
  isReleaseBuild(env) ? null : STAGING_HEADERS;

export const stagingHeaders = (): Plugin => ({
  name: 'gab-staging-headers',
  apply: 'build',
  generateBundle() {
    const source = headersOf(process.env);
    if (source !== null) this.emitFile({ type: 'asset', fileName: '_headers', source });
  },
});
